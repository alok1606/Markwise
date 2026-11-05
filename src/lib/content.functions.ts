import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { runChecks, type BannedRule, type ColourSample, type GlossaryEntry } from './checks';
import { executeAiReview, AiReviewError } from './ai-review.server';
import { checkContentFile, contentFieldsSchema, contentPathPattern, contentTypes, fieldsForType, type ContentType } from './content';

export type RouteFacts = { version: number; version_id: string; status: string; ai_state: 'completed' | 'failed' | 'pending'; blocking: number; route: 'manager' | 'reviewer' };
type Ctx = { supabase: any; userId: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
const ws = z.object({ workspace_id: z.string().uuid() });
const idInput = ws.extend({ id: z.string().uuid() });

async function requireRole(ctx: Ctx, workspaceId: string, role: 'creator' | 'manager', message: string) {
  const { data, error } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: role, _workspace_id: workspaceId });
  if (error || !data) throw new Error(message);
}
async function contentRole(ctx: Ctx, workspaceId: string) {
  const [c, m, rv] = await Promise.all(['creator', 'manager', 'reviewer'].map(r => ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: r, _workspace_id: workspaceId })));
  if (c?.data) return 'creator'; if (m?.data) return 'manager'; if (rv?.data) return 'reviewer';
  throw new Error('You do not have access to content in this workspace');
}
function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }
// Finding count of each item's current-version review (null = not checked), read as the caller under RLS.
async function withCounts<T extends { id: string; version: number }>(ctx: Ctx, rows: T[]) {
  if (!rows.length) return rows.map(r => ({ ...r, finding_count: null as number | null }));
  const r = await ctx.supabase.from('reviews').select('content_id,version_number,finding_count').in('content_id', rows.map(x => x.id));
  const m = new Map<string, number>(); for (const x of r.data ?? []) { const k = `${x.content_id}:${x.version_number}`; m.set(k, (m.get(k) ?? 0) + x.finding_count); }
  return rows.map(x => ({ ...x, finding_count: m.get(`${x.id}:${x.version}`) ?? null }));
}
const listCols = 'id,title,type,channel,status,version,owner_id,created_at,updated_at,submitted_at';

export const listMyContent = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(ws).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators have personal content');
  const r = await context.supabase.from('contents').select(listCols).eq('workspace_id', data.workspace_id).eq('owner_id', context.userId).order('updated_at', { ascending: false });
  fail(r.error); return withCounts(context, r.data ?? []);
});

export const listWorkspaceContent = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(ws).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'manager', 'Only managers can view all workspace content');
  const r = await context.supabase.from('contents').select(listCols).eq('workspace_id', data.workspace_id).neq('status', 'draft').order('submitted_at', { ascending: false });
  fail(r.error);
  const ids = [...new Set((r.data ?? []).map(c => c.owner_id))]; const names = new Map<string, string>();
  if (ids.length) { const p = await context.supabase.from('profiles').select('id,full_name,email').in('id', ids); for (const x of p.data ?? []) names.set(x.id, x.full_name || x.email); }
  return withCounts(context, (r.data ?? []).map(c => ({ ...c, owner_name: names.get(c.owner_id) ?? 'Workspace member' })));
});

export const getContent = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(idInput).handler(async ({ data, context }) => {
  const role = await contentRole(context, data.workspace_id);
  const row = await context.supabase.from('contents').select('*').eq('id', data.id).eq('workspace_id', data.workspace_id).maybeSingle();
  if (row.error || !row.data) throw new Error('Content not found in this workspace');
  const c = row.data;
  const versions = await context.supabase.from('content_versions').select('id,version_number,title,body_text,file_name,file_path,alt_text,text_color,background_color,change_summary,changed_by,created_at').eq('content_id', c.id).order('version_number', { ascending: false });
  fail(versions.error);
  let file_url: string | null = null;
  if (c.file_path) { const s = await context.supabase.storage.from('content-files').createSignedUrl(c.file_path, 600); file_url = s.data?.signedUrl ?? null; }
  const owner = await context.supabase.from('profiles').select('full_name,email').eq('id', c.owner_id).maybeSingle();
  const reviews = await context.supabase.from('reviews').select('id,content_version_id,version_number,run_at,status,dropped_findings_count,downgraded_findings_count,finding_count,limitations,source,model,prompt_version,evidence_text,file_sha256').eq('content_id', c.id).order('version_number', { ascending: false });
  fail(reviews.error);
  const findings = reviews.data?.length ? await context.supabase.from('findings').select('id,review_id,source,check_name,category,severity,confidence,span_start,span_end,quoted_text,explanation,cited_kind,cited_code,cited_passage,outcome,suggested_text,evidence_kind,bbox').eq('content_id', c.id).order('span_start', { ascending: true, nullsFirst: true }) : { data: [], error: null };
  fail(findings.error);
  // Phase 6 records, read as the caller under RLS.
  const [actions, approvals, comments, facts] = await Promise.all([
    context.supabase.from('finding_actions').select('id,finding_id,version_id,action,reason,final_text,result_version_id,actor_id,created_at').eq('content_id', c.id).order('created_at'),
    context.supabase.from('approvals').select('id,version_id,version_number,route,reviewer_id,assigned_by,ai_state_at_routing,status,decision_comment,decided_by,decided_at,created_at').eq('content_id', c.id).order('created_at'),
    context.supabase.from('comments').select('id,parent_id,author_id,message,created_at').eq('content_id', c.id).order('created_at'),
    c.status === 'draft' ? Promise.resolve({ data: null, error: null }) : context.supabase.rpc('approval_route_facts', { _content_id: c.id }),
  ]);
  fail(actions.error); fail(approvals.error); fail(comments.error);
  const people = new Set<string>([...(actions.data ?? []).map((a: { actor_id: string }) => a.actor_id), ...(approvals.data ?? []).flatMap((a: { reviewer_id: string | null; decided_by: string | null; assigned_by: string }) => [a.reviewer_id, a.decided_by, a.assigned_by]), ...(comments.data ?? []).map((x: { author_id: string }) => x.author_id)].filter(Boolean) as string[]);
  const names: Record<string, string> = {};
  if (people.size) { const p = await context.supabase.from('profiles').select('id,full_name,email').in('id', [...people]); for (const x of p.data ?? []) names[x.id] = x.full_name || x.email; }
  return { content: c, versions: versions.data ?? [], reviews: reviews.data ?? [], findings: findings.data ?? [], file_url, owner_name: owner.data?.full_name || owner.data?.email || 'Workspace member',
    is_owner: c.owner_id === context.userId && role === 'creator', role, user_id: context.userId,
    actions: actions.data ?? [], approvals: approvals.data ?? [], comments: comments.data ?? [], route_facts: (facts.data ?? null) as RouteFacts | null, names };
});

export const getVersionFileUrl = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput.extend({ version_id: z.string().uuid() })).handler(async ({ data, context }) => {
  await contentRole(context, data.workspace_id);
  const v = await context.supabase.from('content_versions').select('file_path,file_name').eq('id', data.version_id).eq('content_id', data.id).eq('workspace_id', data.workspace_id).maybeSingle();
  if (v.error || !v.data?.file_path) throw new Error('File not found for this version');
  const s = await context.supabase.storage.from('content-files').createSignedUrl(v.data.file_path, 60, { download: v.data.file_name ?? true });
  if (s.error) throw new Error('Unable to prepare the download');
  return { url: s.data.signedUrl };
});

const fields = contentFieldsSchema;
export const createContent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(ws.extend({ type: z.enum(contentTypes), fields })).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators can create content');
  const f = fieldsForType(data.type, data.fields);
  const r = await context.supabase.rpc('create_content', { _workspace_id: data.workspace_id, _type: data.type, _title: f.title, _channel: f.channel, _audience: f.audience, _goal: f.goal,
    _body_text: data.type === 'text' ? f.body_text : '', _alt_text: f.alt_text as string, _text_color: f.text_color as string, _background_color: f.background_color as string });
  fail(r.error); return { id: r.data as string };
});

export const saveContentDraft = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput.extend({ expected_version: z.number().int().positive(), type: z.enum(contentTypes), fields, pdf_text_confirmed: z.boolean().default(false) })).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators can edit content');
  const f = fieldsForType(data.type, data.fields);
  const r = await context.supabase.rpc('save_content_draft', { _content_id: data.id, _expected_version: data.expected_version, _title: f.title, _channel: f.channel, _audience: f.audience, _goal: f.goal,
    _body_text: f.body_text, _alt_text: f.alt_text as string, _text_color: f.text_color as string, _background_color: f.background_color as string, _pdf_text_confirmed: data.pdf_text_confirmed });
  fail(r.error); return { version: r.data as number };
});

// Browser-read image colours are an untrusted sample: strictly shaped, and only ever used by the palette check.
const imageSample = { colour_samples: z.array(z.object({ hex: z.string().regex(/^#[0-9A-F]{6}$/), share: z.number().min(0).max(1) })).max(8).nullable().default(null), image_error: z.string().max(200).nullable().default(null) };

export async function executeChecks(ctx: Ctx, workspaceId: string, contentId: string, samples: ColourSample[] | null, imageError: string | null) {
  // Every read here runs as the caller, so RLS confirms ownership before any privileged step.
  const row = await ctx.supabase.from('contents').select('id,owner_id,status,version,type').eq('id', contentId).eq('workspace_id', workspaceId).maybeSingle();
  if (row.error || !row.data || row.data.owner_id !== ctx.userId) throw new Error('Content not found in this workspace');
  if (row.data.status !== 'submitted') throw new Error('Checks run only on submitted content');
  const ver = await ctx.supabase.from('content_versions').select('id,version_number,body_text,alt_text,text_color,background_color').eq('content_id', contentId).eq('version_number', row.data.version).maybeSingle();
  if (ver.error || !ver.data) throw new Error('Submitted version not found');
  const existing = await ctx.supabase.from('reviews').select('id').eq('content_version_id', ver.data.id).eq('source', 'deterministic').maybeSingle();
  if (existing.data) throw new Error('Checks already ran for this version');
  // Knowledge Base stays Admin-only: read only what the checks need, server-side, never returned to the caller as records.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const type = row.data.type as ContentType;
  const [rules, glossary, palette] = await Promise.all([
    type === 'image' ? { data: [], error: null } : supabaseAdmin.from('rules').select('id,code,title,description,severity,category,active,kind,pattern').eq('workspace_id', workspaceId).eq('active', true).eq('kind', 'banned_term'),
    type === 'image' ? { data: [], error: null } : supabaseAdmin.from('glossary').select('id,preferred_term,avoided_terms,case_sensitive,note').eq('workspace_id', workspaceId),
    type === 'image' ? supabaseAdmin.from('palette').select('id,name,hex').eq('workspace_id', workspaceId) : { data: [], error: null },
  ]);
  if (rules.error || glossary.error || palette.error) throw new Error('Unable to load workspace guidelines for checking');
  const v = ver.data;
  const result = runChecks({ type, body_text: v.body_text, alt_text: v.alt_text, text_color: v.text_color, background_color: v.background_color,
    rules: (rules.data ?? []) as BannedRule[], glossary: (glossary.data ?? []) as GlossaryEntry[], palette: palette.data ?? [], colour_samples: samples, image_error: imageError });
  const r = await supabaseAdmin.rpc('record_review', { _actor: ctx.userId, _content_id: contentId, _content_version_id: v.id, _findings: result.findings as never, _dropped: result.dropped, _limitations: result.limitations as never });
  if (r.error) throw new Error(r.error.message);
  return { review_id: r.data as string, findings: result.findings.length, limitations: result.limitations };
}

export const submitContent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput.extend({ expected_version: z.number().int().positive(), ...imageSample })).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators can submit content');
  const r = await context.supabase.rpc('submit_content', { _content_id: data.id, _expected_version: data.expected_version }); fail(r.error);
  // Submission stands even if checking fails; nothing partial is saved and the owner can run the checks once.
  let checks = null; let check_error: string | null = null;
  try { checks = await executeChecks(context, data.workspace_id, data.id, data.colour_samples, data.image_error); }
  catch (e) { check_error = e instanceof Error ? e.message : 'Automatic checks failed'; }
  // The AI review runs separately: its failure never undoes the submission or the deterministic findings.
  let ai = null; let ai_error: string | null = null;
  try { ai = await aiReview(context, data.workspace_id, data.id); } catch (e) { ai_error = e instanceof Error ? e.message : 'AI review failed'; }
  return { checks, check_error, ai, ai_error };
});

export async function aiReview(ctx: Ctx, workspaceId: string, contentId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return executeAiReview({ caller: ctx.supabase, admin: supabaseAdmin as never, userId: ctx.userId, workspaceId, contentId });
}

/** Owner-only retry: allowed only while no AI review exists for the submitted version (a failed attempt saves nothing). */
export const runAiReview = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only the content owner can run the AI review');
  try { return { ai: await aiReview(context, data.workspace_id, data.id), ai_error: null }; }
  catch (e) { if (e instanceof AiReviewError) return { ai: null, ai_error: e.message }; throw e; }
});

export const runContentChecks = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput.extend(imageSample)).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only the content owner can run checks');
  return executeChecks(context, data.workspace_id, data.id, data.colour_samples, data.image_error);
});

export const deleteContentDraft = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators can delete drafts');
  const r = await context.supabase.rpc('delete_content_draft', { _content_id: data.id }); fail(r.error);
});

export const registerContentFile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput.extend({ expected_version: z.number().int().positive(), path: z.string().max(200), name: z.string().trim().min(1).max(200) })).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators can upload content files');
  if (!contentPathPattern(data.workspace_id, data.id).test(data.path)) throw new Error('Invalid file location');
  // Read the content as the caller (RLS) to confirm ownership before any privileged step.
  const row = await context.supabase.from('contents').select('id,type,status,owner_id').eq('id', data.id).eq('workspace_id', data.workspace_id).maybeSingle();
  if (row.error || !row.data || row.data.owner_id !== context.userId) throw new Error('Content not found in this workspace');
  if (row.data.status !== 'draft' && row.data.status !== 'changes_requested') throw new Error('Submitted content cannot be edited');
  if (row.data.type === 'text') throw new Error('Text content has no file');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const discard = async () => { await supabaseAdmin.storage.from('content-files').remove([data.path]); };
  const file = await context.supabase.storage.from('content-files').download(data.path);
  if (file.error || !file.data) throw new Error('Upload not found; please try again');
  const buf = new Uint8Array(await file.data.arrayBuffer());
  const ext = data.path.split('.').pop() ?? '';
  const problem = checkContentFile(row.data.type as Exclude<ContentType, 'text'>, buf.subarray(0, 16), buf.byteLength, ext);
  if (problem) { await discard(); throw new Error(problem); }
  const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' }[ext]!;
  const r = await supabaseAdmin.rpc('set_content_file', { _actor: context.userId, _content_id: data.id, _expected_version: data.expected_version, _file_path: data.path, _file_name: data.name, _file_mime: mime, _file_size: buf.byteLength });
  if (r.error) { await discard(); throw new Error(r.error.message); }
  return { version: r.data as number };
});
