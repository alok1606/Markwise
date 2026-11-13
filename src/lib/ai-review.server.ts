// Server-only Phase 5 AI review orchestration. Injectable model caller so failures can be tested without the network.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModelMessage } from 'ai';
import { AI_PROMPT_VERSION, AI_SYSTEM_INSTRUCTION, aiErrorMessages, buildSources, contextForPrompt, InvalidAiResponseError, validateAiResponse, type AiErrorKind, type FactRow, type GlossaryRow, type RuleRow } from './ai-review';
import { AI_MODEL, AI_PROVIDER, AiCallError, callGatewayModel, type ModelCaller } from './ai-gateway.server';

export class AiReviewError extends Error { constructor(public kind: AiErrorKind) { super(aiErrorMessages[kind]); } }

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const categories = 'legal, claim, terminology, tone, visual, accessibility';

export function buildReviewContext(sources: ReturnType<typeof buildSources>) {
  return `Approved sources for this workspace (JSON):\n${contextForPrompt(sources)}\n\nUse category values from: ${categories}. cited_code must be one of the codes above or null. cited_passage must be copied exactly from that source's text. quoted_text must be copied exactly, character for character. Use verdict violation for a breach of a rule or use of a glossary avoided term; use supported or contradicted only for claims checked against facts.`;
}

/** Shared text prompt assembly for production reviews and the labelled accuracy harness. */
export function buildTextReviewMessages(text: string, sources: ReturnType<typeof buildSources>): ModelMessage[] {
  const ctx = buildReviewContext(sources);
  return [{ role: 'user', content: `${ctx}\n\nContent to review (between the markers):\n<<<CONTENT\n${text}\nCONTENT>>>\n\nSet visible_text to null and bbox to null.` }];
}

async function sha256Hex(buf: Uint8Array) {
  const d = await crypto.subtle.digest('SHA-256', buf as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Runs one AI review for the exact submitted version of the caller's own content.
 * `caller` is the user's RLS client (proves ownership); `admin` is used only after that check, to read sources and record.
 * Never touches deterministic reviews/findings. Failures save no review and are logged to ai_calls.
 */
export async function executeAiReview(deps: { caller: SupabaseClient; admin: SupabaseClient; userId: string; workspaceId: string; contentId: string; callModel?: ModelCaller; today?: string }) {
  const { caller, admin, userId, workspaceId, contentId } = deps;
  const callModel = deps.callModel ?? callGatewayModel;
  const row = await caller.from('contents').select('id,owner_id,status,version,type').eq('id', contentId).eq('workspace_id', workspaceId).maybeSingle();
  if (row.error || !row.data || row.data.owner_id !== userId) throw new Error('Content not found in this workspace');
  if (row.data.status !== 'submitted' && row.data.status !== 'checked') throw new Error('AI review runs only on submitted or checked content');
  const ver = await caller.from('content_versions').select('id,version_number,body_text,file_path,file_mime').eq('content_id', contentId).eq('version_number', row.data.version).maybeSingle();
  if (ver.error || !ver.data) throw new Error('Submitted version not found');
  const v = ver.data;
  const existing = await caller.from('reviews').select('id').eq('content_version_id', v.id).eq('source', 'ai').maybeSingle();
  if (existing.data) throw new AiReviewError('already_reviewed');
  const isImage = row.data.type === 'image';

  const log = async (status: 'failed', kind: AiErrorKind, summary: string) => {
    await admin.from('ai_calls').insert({ workspace_id: workspaceId, content_id: contentId, content_version_id: v.id, requested_by: userId, provider: AI_PROVIDER, model: AI_MODEL, prompt_version: AI_PROMPT_VERSION, what_was_sent_summary: summary, status, error_kind: kind });
  };

  // Knowledge Base stays Admin-only: read server-side, only what this review needs, never returned as records.
  const [rules, facts, glossary] = await Promise.all([
    admin.from('rules').select('id,code,title,description,explanation,examples,category,kind,severity,active').eq('workspace_id', workspaceId).eq('active', true),
    admin.from('facts').select('id,code,title,statement,evidence,status,active,valid_from,valid_until').eq('workspace_id', workspaceId).eq('active', true).eq('status', 'approved'),
    admin.from('glossary').select('id,preferred_term,avoided_terms,note,usage_example').eq('workspace_id', workspaceId),
  ]);
  if (rules.error || facts.error || glossary.error) throw new Error('Unable to load workspace guidelines for the AI review');
  const sources = buildSources((rules.data ?? []) as RuleRow[], (facts.data ?? []) as FactRow[], (glossary.data ?? []) as GlossaryRow[], deps.today ?? new Date().toISOString().slice(0, 10));
  const ctx = buildReviewContext(sources);
  const counts = `${sources.filter(s => s.kind === 'rule').length} rules, ${sources.filter(s => s.kind === 'fact').length} facts, ${sources.filter(s => s.kind === 'glossary').length} glossary`;
  let messages: ModelMessage[]; let summary: string; let sha: string | null = null; let evidenceText: string | null = null;
  if (isImage) {
    if (!v.file_path || !v.file_mime || !IMAGE_MIME.has(v.file_mime)) { await log('failed', 'unsupported_file', `image; unsupported or missing file; ${counts}`); throw new AiReviewError('unsupported_file'); }
    const file = await admin.storage.from('content-files').download(v.file_path);
    if (file.error || !file.data) throw new Error('Image file for this version could not be read');
    const buf = new Uint8Array(await file.data.arrayBuffer()); sha = await sha256Hex(buf);
    summary = `image; ${v.file_mime}; ${buf.byteLength} bytes; sha256 ${sha.slice(0, 12)}…; ${counts}`;
    messages = [{ role: 'user', content: [
      { type: 'text', text: `${ctx}\n\nReview only the visible text in this image against the sources. First transcribe all visible text exactly into visible_text. Each quoted_text must be an exact substring of visible_text. bbox is required for every finding: the bounding box of the quoted text as [ymin, xmin, ymax, xmax] on a 0–1000 scale.` },
      { type: 'image', image: buf, mediaType: v.file_mime },
    ] }];
  } else {
    const text: string = v.body_text ?? ''; evidenceText = text;
    if (!text.trim()) { await log('failed', 'unsupported_file', `${row.data.type}; no text; ${counts}`); throw new AiReviewError('unsupported_file'); }
    summary = `${row.data.type}; ${text.length} characters of submitted text; ${counts}`;
    messages = buildTextReviewMessages(text, sources);
  }

  let raw: unknown;
  try { raw = await callModel({ system: AI_SYSTEM_INSTRUCTION, messages }); }
  catch (e) { const kind = e instanceof AiCallError ? e.kind : 'network'; await log('failed', kind, summary); throw new AiReviewError(kind); }

  let result;
  try { result = validateAiResponse(raw, { evidenceText, isImage, sources }); }
  catch (e) { if (e instanceof InvalidAiResponseError) { await log('failed', 'invalid_response', summary); throw new AiReviewError('invalid_response'); } throw e; }

  const limitations = isImage ? ['Image review covers visible text only, as read by the AI, checked against the supplied rules and facts.'] : [];
  const r = await admin.rpc('record_ai_review', { _actor: userId, _content_id: contentId, _content_version_id: v.id, _findings: result.findings as never, _dropped: result.dropped, _downgraded: result.downgraded,
    _limitations: limitations as never, _model: AI_MODEL, _prompt_version: AI_PROMPT_VERSION, _evidence_text: isImage ? result.evidence_text : null as never, _file_sha256: sha as never, _sent_summary: summary });
  if (r.error) {
    const dup = /already exists/i.test(r.error.message);
    await log('failed', dup ? 'already_reviewed' : 'save_failed', summary);
    throw new AiReviewError(dup ? 'already_reviewed' : 'save_failed');
  }
  return { review_id: r.data as string, findings: result.findings.length, dropped: result.dropped, downgraded: result.downgraded };
}
