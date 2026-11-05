// Pure, client-safe Phase 5 AI review validation. No network, no I/O.
// The AI's output is untrusted: every quote, offset, citation and image box is re-checked here
// against the exact submitted version and the sources actually sent for this review.
import { z } from 'zod';

export const AI_PROMPT_VERSION = 'p5-v2';

/** Master Specification Part 7 G, AI system instruction (verbatim). */
export const AI_SYSTEM_INSTRUCTION = `Analyze the supplied content using only the supplied approved rules, facts and glossary entries.

Do not use outside knowledge to substantiate company claims.

Every numeric or factual claim must receive one verdict:
- supported
- contradicted
- cannot_verify

For supported or contradicted findings, provide the exact source code and exact supporting passage.

If no approved source supports the claim, return cannot_verify.

Flag tone issues only when an applicable approved tone rule exists.

Do not invent rules, facts, IDs, citations or source passages.

Any suggested rewrite must preserve the author's intended meaning and modify only the relevant flagged text, except when a coordinated sentence-level rewrite is necessary for multiple findings.`;

const severities = ['critical', 'high', 'medium', 'low'] as const;
const verdicts = ['violation', 'supported', 'contradicted', 'cannot_verify'] as const;

/** Strict response schema (kept small and flat for Gemini). */
export const aiFindingSchema = z.object({
  quoted_text: z.string(),
  verdict: z.enum(verdicts),
  category: z.string(),
  severity: z.enum(severities),
  confidence: z.number(),
  explanation: z.string(),
  cited_code: z.string().nullable(),
  cited_passage: z.string().nullable(),
  suggested_text: z.string().nullable(),
  bbox: z.array(z.number()).nullable(),
});
export const aiResponseSchema = z.object({ visible_text: z.string().nullable(), findings: z.array(aiFindingSchema) });
export type AiResponse = z.infer<typeof aiResponseSchema>;

export type SourceKind = 'rule' | 'fact' | 'glossary';
/** One source included in the review context. `text` is exactly what the database searches for the cited passage. */
export type AiSource = { kind: SourceKind; id: string; code: string; text: string; tone: boolean };

export type RuleRow = { id: string; code: string; title: string; description: string; explanation: string; examples: string; category: string; kind: string; severity: string; active: boolean };
export type FactRow = { id: string; code: string; title: string; statement: string; evidence: string; status: string; active: boolean; valid_from: string | null; valid_until: string | null };
export type GlossaryRow = { id: string; preferred_term: string; avoided_terms: string[]; note: string; usage_example: string };

export const glossaryCode = (g: { preferred_term: string }) => `GLOSSARY:${g.preferred_term}`;

/** Builds the context: only active rules, approved/active/in-date facts, and glossary of one workspace. */
export function buildSources(rules: RuleRow[], facts: FactRow[], glossary: GlossaryRow[], today: string): AiSource[] {
  const out: AiSource[] = [];
  for (const r of rules) if (r.active) out.push({ kind: 'rule', id: r.id, code: r.code, text: [r.title, r.description, r.explanation, r.examples].join('\n'), tone: r.category === 'tone' || r.kind === 'tone_guidance' });
  for (const f of facts) if (f.active && f.status === 'approved' && (!f.valid_from || f.valid_from <= today) && (!f.valid_until || f.valid_until >= today)) out.push({ kind: 'fact', id: f.id, code: f.code, text: [f.statement, f.evidence].join('\n'), tone: false });
  for (const g of glossary) out.push({ kind: 'glossary', id: g.id, code: glossaryCode(g), text: [g.preferred_term, g.avoided_terms.join('\n'), g.note, g.usage_example].join('\n'), tone: false });
  return out;
}

/** The context block sent to the model: codes and passages only, no database IDs. */
export function contextForPrompt(sources: AiSource[]) {
  return JSON.stringify({
    rules: sources.filter(s => s.kind === 'rule').map(s => ({ code: s.code, text: s.text, tone_rule: s.tone })),
    facts: sources.filter(s => s.kind === 'fact').map(s => ({ code: s.code, text: s.text })),
    glossary: sources.filter(s => s.kind === 'glossary').map(s => ({ code: s.code, text: s.text })),
  });
}

export type ValidatedFinding = {
  category: string; severity: (typeof severities)[number]; confidence: number; span_start: number; span_end: number; quoted_text: string; explanation: string;
  cited_kind: SourceKind | 'none'; cited_id: string | null; cited_code: string; cited_passage: string; outcome: (typeof verdicts)[number];
  suggested_text: string | null; evidence_kind: 'text' | 'image_ocr'; bbox: number[] | null;
};
export type ValidationResult = { findings: ValidatedFinding[]; dropped: number; downgraded: number; evidence_text: string };

export class InvalidAiResponseError extends Error { constructor() { super('The AI returned a response in an invalid format'); } }

const compatible: Record<string, SourceKind[]> = { violation: ['rule', 'glossary'], supported: ['fact'], contradicted: ['fact'] };
const MAX_FINDINGS = 200;

export function validBbox(b: number[] | null): b is number[] {
  if (!b || b.length !== 4 || b.some(n => !Number.isFinite(n))) return false;
  const [x, y, w, h] = b as [number, number, number, number];
  return x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001;
}

/** Converts the model's [ymin, xmin, ymax, xmax] box on a 0–1000 scale into normalised [x, y, width, height]. */
export function fromGeminiBox(b: number[] | null): number[] | null {
  if (!b || b.length !== 4 || b.some(n => !Number.isFinite(n) || n < 0 || n > 1000)) return null;
  const [ymin, xmin, ymax, xmax] = b as [number, number, number, number];
  return [xmin / 1000, ymin / 1000, (xmax - xmin) / 1000, (ymax - ymin) / 1000];
}

/**
 * Validates an untrusted AI response.
 * - Invalid schema: whole response rejected (throws).
 * - Quote not an exact substring of the evidence text (version text, or the image's OCR text): finding dropped.
 * - Offsets are computed here, never taken from the AI (UTF-16, next unused occurrence).
 * - Citation unknown, outside the sent context, passage absent, or wrong kind for the verdict: downgraded to cannot_verify with no citation.
 * - Tone findings without a cited tone rule: dropped.
 * - Image findings without a valid normalised box: downgraded.
 */
export function validateAiResponse(raw: unknown, opts: { evidenceText: string | null; isImage: boolean; sources: AiSource[] }): ValidationResult {
  const parsed = aiResponseSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidAiResponseError();
  const evidence = opts.isImage ? (parsed.data.visible_text ?? '') : (opts.evidenceText ?? '');
  const byCode = new Map(opts.sources.map(s => [s.code, s]));
  const used = new Map<string, number>();
  const out: ValidatedFinding[] = []; let dropped = 0; let downgraded = 0;
  for (const f of parsed.data.findings) {
    if (out.length >= MAX_FINDINGS) { dropped++; continue; }
    const quote = f.quoted_text;
    const from = used.get(quote) ?? 0;
    const at = quote.length ? evidence.indexOf(quote, from) : -1;
    if (at < 0) { dropped++; continue; }
    const src = f.cited_code ? byCode.get(f.cited_code) : undefined;
    const isTone = f.category.trim().toLowerCase() === 'tone';
    if (isTone && !(src && src.tone)) { dropped++; continue; }
    used.set(quote, at + Math.max(quote.length, 1));
    let outcome: ValidatedFinding['outcome'] = f.verdict; let cited: Pick<ValidatedFinding, 'cited_kind' | 'cited_id' | 'cited_code' | 'cited_passage'> = { cited_kind: 'none', cited_id: null, cited_code: '', cited_passage: '' };
    if (outcome !== 'cannot_verify') {
      const passage = f.cited_passage ?? '';
      const ok = !!src && passage.trim().length > 0 && src.text.toLowerCase().includes(passage.toLowerCase()) && (compatible[outcome] ?? []).includes(src.kind);
      if (ok) cited = { cited_kind: src!.kind, cited_id: src!.id, cited_code: src!.code, cited_passage: passage };
      else { outcome = 'cannot_verify'; downgraded++; }
    }
    let bbox: number[] | null = null;
    if (opts.isImage) {
      const b = fromGeminiBox(f.bbox);
      if (validBbox(b)) bbox = b.map(n => Math.round(n * 10000) / 10000);
      else if (outcome !== 'cannot_verify') { outcome = 'cannot_verify'; cited = { cited_kind: 'none', cited_id: null, cited_code: '', cited_passage: '' }; downgraded++; }
    }
    out.push({
      category: (f.category.trim() || 'general').slice(0, 40), severity: f.severity, confidence: Math.min(1, Math.max(0, Number.isFinite(f.confidence) ? f.confidence : 0)),
      span_start: at, span_end: at + quote.length, quoted_text: quote, explanation: f.explanation.slice(0, 2000) || 'No explanation given.', ...cited, outcome,
      suggested_text: f.suggested_text?.trim() ? f.suggested_text.slice(0, 2000) : null, evidence_kind: opts.isImage ? 'image_ocr' : 'text', bbox,
    });
  }
  return { findings: out, dropped, downgraded, evidence_text: evidence };
}

/** Presentation-only dedup: links each AI text finding to overlapping deterministic findings. Both records stay untouched. */
export function overlapsWithDeterministic<A extends { id: string; span_start: number | null; span_end: number | null; evidence_kind?: string | null }, D extends { id: string; check_name: string; span_start: number | null; span_end: number | null }>(ai: A[], det: D[]) {
  const m = new Map<string, D[]>();
  for (const a of ai) {
    if (a.evidence_kind === 'image_ocr' || a.span_start === null || a.span_end === null) continue;
    const hits = det.filter(d => d.span_start !== null && d.span_end !== null && d.span_start < a.span_end! && a.span_start! < d.span_end);
    if (hits.length) m.set(a.id, hits);
  }
  return m;
}

export type AiErrorKind = 'rate_limited' | 'credits' | 'timeout' | 'invalid_response' | 'network' | 'unsupported_file' | 'unavailable' | 'configuration' | 'save_failed' | 'already_reviewed' | 'refused';
export const aiErrorMessages: Record<AiErrorKind, string> = {
  rate_limited: 'The AI service is busy right now (rate limit). Please try the AI review again in a minute.',
  credits: 'The workspace has run out of AI credits. Add credits, then run the AI review again.',
  timeout: 'The AI review took too long and was stopped. Please try again.',
  invalid_response: 'The AI returned an answer in an invalid format, so nothing was saved. Please try again.',
  network: 'Could not reach the AI service (network error). Please try again.',
  unsupported_file: 'This file type cannot be reviewed by the AI.',
  unavailable: 'The AI model is currently unavailable. Nothing was saved.',
  configuration: 'The AI service is not configured correctly. Nothing was saved.',
  save_failed: 'The AI review finished but could not be saved. Nothing was saved; please try again.',
  already_reviewed: 'An AI review already exists for this version.',
  refused: 'The AI declined to review this content. Nothing was saved.',
};

/** Maps an HTTP status from the AI service to an error kind. */
export function errorKindForStatus(status: number | undefined): AiErrorKind {
  if (status === 429) return 'rate_limited';
  if (status === 402) return 'credits';
  if (status === 401) return 'configuration';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 400) return 'configuration';
  return 'unavailable';
}
