// @vitest-environment node
// Live Phase 5 AI review security, integrity and failure tests. The model is replaced by a fake caller (no AI cost);
// everything else (ownership checks, source loading, validation, atomic recording, RLS) runs for real.
// Requires MARKWISE_CONTENT_FIXTURE (admin, manager, reviewer, creator, creator2 in A; admin_b, creator_b in B) and SUPABASE_SERVICE_ROLE_KEY.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runChecks, type BannedRule } from '@/lib/checks';
import { executeAiReview, AiReviewError } from '@/lib/ai-review.server';
import { AiCallError } from '@/lib/ai-gateway.server';

const fixturePath = process.env['MARKWISE_CONTENT_FIXTURE'];
const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY']; const service = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const mk = (k: string) => createClient(url!, k, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!fixturePath || !url || !key || !service)('Live Phase 5 AI review', { timeout: 120_000 }, () => {
  const c: Record<string, SupabaseClient> = {}; const uid: Record<string, string> = {}; let A = ''; let B = ''; let admin: SupabaseClient;
  let ruleId = ''; let inactiveId = ''; let factId = ''; let pendingFactId = '';
  const body = 'Guaranteed onboarding for clients in 2 days, 40% faster. 🚀';
  const good = { visible_text: null, findings: [
    { quoted_text: 'Guaranteed', verdict: 'violation', category: 'legal', severity: 'critical', confidence: 0.9, explanation: 'Promise of results', cited_code: 'P5-R', cited_passage: 'Never promise guaranteed results.', suggested_text: 'Reliable', bbox: null },
    { quoted_text: 'in 2 days', verdict: 'contradicted', category: 'claim', severity: 'high', confidence: 0.8, explanation: 'Fact says 5 days', cited_code: 'P5-F', cited_passage: 'Onboarding takes 5 days on average.', suggested_text: 'in 5 days', bbox: null },
    { quoted_text: '40% faster', verdict: 'supported', category: 'claim', severity: 'medium', confidence: 0.7, explanation: 'Fabricated support', cited_code: 'P5-FAKE', cited_passage: 'Made up', suggested_text: null, bbox: null },
    { quoted_text: 'onboarding', verdict: 'violation', category: 'legal', severity: 'high', confidence: 0.6, explanation: 'Inactive rule', cited_code: 'P5-OFF', cited_passage: 'Old rule', suggested_text: null, bbox: null },
    { quoted_text: 'not in the text', verdict: 'cannot_verify', category: 'claim', severity: 'low', confidence: 0.5, explanation: 'Fabricated quote', cited_code: null, cited_passage: null, suggested_text: null, bbox: null },
  ] };
  const fake = (out: unknown) => async () => out;
  const failing = (kind: ConstructorParameters<typeof AiCallError>[0]) => async () => { throw new AiCallError(kind); };
  const ai = (contentId: string, callModel: () => Promise<unknown>, who = 'creator') => executeAiReview({ caller: c[who]!, admin, userId: uid[who]!, workspaceId: A, contentId, callModel });

  async function submitted(text: string) {
    const id = (await c['creator']!.rpc('create_content', { _workspace_id: A, _type: 'text', _title: 'AI', _channel: '', _audience: '', _goal: '', _body_text: text, _alt_text: null as never, _text_color: null as never, _background_color: null as never })).data as string;
    expect((await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 1 })).error).toBeNull();
    const vid = (await c['creator']!.from('content_versions').select('id').eq('content_id', id).eq('version_number', 1).single()).data!.id as string;
    const rules = ((await admin.from('rules').select('id,code,title,description,severity,category,active,kind,pattern').eq('workspace_id', A).eq('code', 'P5-R')).data ?? []) as BannedRule[];
    const det = runChecks({ type: 'text', body_text: text, alt_text: null, text_color: null, background_color: null, rules, glossary: [], palette: [], colour_samples: null });
    expect((await admin.rpc('record_review', { _actor: uid['creator']!, _content_id: id, _content_version_id: vid, _findings: det.findings as never, _dropped: det.dropped, _limitations: [] as never })).error).toBeNull();
    return { id, vid };
  }
  const aiReviews = async (id: string) => (await admin.from('reviews').select('id,source').eq('content_id', id).eq('source', 'ai')).data ?? [];
  const detSnapshot = async (id: string) => JSON.stringify((await admin.from('findings').select('*').eq('content_id', id).eq('source', 'deterministic').order('id')).data);

  beforeAll(async () => {
    const fx = JSON.parse(await readFile(fixturePath!, 'utf8')) as { workspaceA: string; workspaceB: string; accounts: { role: string; email: string; password: string }[] };
    A = fx.workspaceA; B = fx.workspaceB; admin = mk(service!);
    for (const a of fx.accounts) { const cl = mk(key!); const s = await cl.auth.signInWithPassword({ email: a.email, password: a.password }); if (s.error) throw new Error(`${a.role}: ${s.error.message}`); c[a.role] = cl; uid[a.role] = s.data.user!.id; }
    const ins = async (t: string, row: Record<string, unknown>) => (await c['admin']!.from(t).insert({ workspace_id: A, ...row }).select('id').single()).data!.id as string;
    ruleId = await ins('rules', { code: 'P5-R', category: 'legal', title: 'No guarantees', description: 'Never promise guaranteed results.', severity: 'critical', rule_type: 'prohibited', kind: 'banned_term', pattern: { terms: ['guaranteed'] } });
    inactiveId = await ins('rules', { code: 'P5-OFF', category: 'legal', title: 'Old rule', description: 'Old rule', severity: 'low', rule_type: 'prohibited', kind: 'tone_guidance', active: false });
    factId = await ins('facts', { code: 'P5-F', title: 'Onboarding', statement: 'Onboarding takes 5 days on average.', evidence: 'Ops' });
    expect((await c['admin']!.from('facts').update({ status: 'approved' }).eq('id', factId)).error).toBeNull();
    pendingFactId = await ins('facts', { code: 'P5-P', title: 'Speed', statement: 'We are 40% faster.', evidence: 'Draft' });
  });
  afterAll(async () => {
    await c['admin']?.from('facts').delete().in('id', [factId, pendingFactId]);
    await c['admin']?.from('rules').delete().in('id', [ruleId, inactiveId]);
  });

  it('saves one AI review for the exact version, keeps valid citations, downgrades/drops the rest, leaves deterministic findings untouched', async () => {
    const s = await submitted(body); const before = await detSnapshot(s.id);
    const r = await ai(s.id, fake(good));
    expect(r).toMatchObject({ findings: 4, dropped: 1, downgraded: 2 });
    const rv = (await c['creator']!.from('reviews').select('content_version_id,source,downgraded_findings_count,dropped_findings_count,model,prompt_version').eq('content_id', s.id).eq('source', 'ai').single()).data!;
    expect(rv).toMatchObject({ content_version_id: s.vid, downgraded_findings_count: 2, dropped_findings_count: 1, model: 'google/gemini-3-flash-preview', prompt_version: 'p5-v2' });
    const f = (await c['creator']!.from('findings').select('quoted_text,outcome,cited_kind,cited_id,cited_code,span_start,span_end').eq('content_id', s.id).eq('source', 'ai').order('span_start')).data!;
    expect(f.find(x => x.cited_code === 'P5-R')).toMatchObject({ outcome: 'violation', cited_kind: 'rule', cited_id: ruleId, span_start: 0, span_end: 10 });
    expect(f.find(x => x.cited_code === 'P5-F')).toMatchObject({ outcome: 'contradicted', cited_kind: 'fact', cited_id: factId });
    expect(f.filter(x => x.cited_kind === 'none').map(x => x.outcome)).toEqual(['cannot_verify', 'cannot_verify']);
    for (const x of f) expect(body.slice(x.span_start!, x.span_end!)).toBe(x.quoted_text);
    expect(await detSnapshot(s.id)).toBe(before);
    const audit = (await admin.from('audit_log').select('action').eq('entity_id', s.id).eq('action', 'ai_review_completed')).data!;
    expect(audit).toHaveLength(1);
    const calls = (await admin.from('ai_calls').select('status,what_was_sent_summary').eq('content_id', s.id)).data!;
    expect(calls).toHaveLength(1); expect(calls[0]!.status).toBe('succeeded'); expect(calls[0]!.what_was_sent_summary).not.toContain('Guaranteed');
  });

  it('refuses a second AI review and allows exactly one under concurrency', async () => {
    const s = await submitted(body);
    const results = await Promise.allSettled([ai(s.id, fake(good)), ai(s.id, fake(good)), ai(s.id, fake(good))]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await aiReviews(s.id)).toHaveLength(1);
    await expect(ai(s.id, fake(good))).rejects.toBeInstanceOf(AiReviewError);
  });

  it('on every failure kind saves no AI review, logs the failed call, keeps Phase 4 findings, and allows a retry', async () => {
    const s = await submitted(body); const before = await detSnapshot(s.id);
    for (const k of ['rate_limited', 'credits', 'timeout', 'network', 'unavailable'] as const) {
      const e = await ai(s.id, failing(k)).catch(x => x);
      expect(e).toBeInstanceOf(AiReviewError); expect((e as AiReviewError).kind).toBe(k);
    }
    const bad = await ai(s.id, fake({ findings: 'nope' })).catch(x => x); expect((bad as AiReviewError).kind).toBe('invalid_response');
    expect(await aiReviews(s.id)).toHaveLength(0);
    expect(await detSnapshot(s.id)).toBe(before);
    const det = (await c['creator']!.from('reviews').select('id').eq('content_id', s.id).eq('source', 'deterministic')).data!; expect(det).toHaveLength(1);
    const calls = (await admin.from('ai_calls').select('status,error_kind').eq('content_id', s.id)).data!;
    expect(calls.map(x => x.error_kind).sort()).toEqual(['credits', 'invalid_response', 'network', 'rate_limited', 'timeout', 'unavailable']);
    expect(calls.every(x => x.status === 'failed')).toBe(true);
    await ai(s.id, fake(good)); expect(await aiReviews(s.id)).toHaveLength(1);
  });

  it('database rejects fabricated, inactive, unapproved or mismatched citations atomically', async () => {
    const s = await submitted(body);
    const base = { category: 'claim', severity: 'high', confidence: 0.5, span_start: 0, span_end: 10, quoted_text: 'Guaranteed', explanation: 'x', suggested_text: null, evidence_kind: 'text', bbox: null };
    const rec = (f: Record<string, unknown>) => admin.rpc('record_ai_review', { _actor: uid['creator']!, _content_id: s.id, _content_version_id: s.vid, _findings: [{ ...base, outcome: 'cannot_verify', cited_kind: 'none', cited_id: null, cited_code: '', cited_passage: '' }, { ...base, ...f }] as never, _dropped: 0, _downgraded: 0, _limitations: [] as never, _model: 'm', _prompt_version: 'p', _evidence_text: null as never, _file_sha256: null as never, _sent_summary: 's' });
    const bad = [
      { outcome: 'violation', cited_kind: 'rule', cited_id: ruleId, cited_code: 'P5-R', cited_passage: 'Invented passage' },
      { outcome: 'violation', cited_kind: 'rule', cited_id: inactiveId, cited_code: 'P5-OFF', cited_passage: 'Old rule' },
      { outcome: 'supported', cited_kind: 'fact', cited_id: pendingFactId, cited_code: 'P5-P', cited_passage: 'We are 40% faster.' },
      { outcome: 'supported', cited_kind: 'fact', cited_id: factId, cited_code: 'WRONG', cited_passage: 'Onboarding' },
      { outcome: 'violation', cited_kind: 'fact', cited_id: factId, cited_code: 'P5-F', cited_passage: 'Onboarding' },
      { outcome: 'violation', cited_kind: 'none', cited_id: null, cited_code: '', cited_passage: '' },
      { outcome: 'supported', cited_kind: 'none', cited_id: null, cited_code: 'P5-F', cited_passage: '' },
    ];
    for (const f of bad) { const r = await rec(f); expect(r.error, JSON.stringify(f)).not.toBeNull(); }
    expect(await aiReviews(s.id)).toHaveLength(0);
    expect((await admin.from('findings').select('id').eq('content_id', s.id).eq('source', 'ai')).data).toHaveLength(0);
  });

  it('only the owner Creator can run it; drafts and other users are refused', async () => {
    const s = await submitted(body);
    for (const who of ['creator2', 'manager', 'reviewer', 'admin']) await expect(executeAiReview({ caller: c[who]!, admin, userId: uid[who]!, workspaceId: A, contentId: s.id, callModel: fake(good) })).rejects.toThrow();
    await expect(executeAiReview({ caller: c['creator_b']!, admin, userId: uid['creator_b']!, workspaceId: B, contentId: s.id, callModel: fake(good) })).rejects.toThrow();
    const draft = (await c['creator']!.rpc('create_content', { _workspace_id: A, _type: 'text', _title: 'D', _channel: '', _audience: '', _goal: '', _body_text: body, _alt_text: null as never, _text_color: null as never, _background_color: null as never })).data as string;
    await expect(ai(draft, fake(good))).rejects.toThrow(/submitted/);
    expect(await aiReviews(s.id)).toHaveLength(0);
    for (const who of Object.keys(c)) {
      const r = await c[who]!.rpc('record_ai_review', { _actor: uid[who]!, _content_id: s.id, _content_version_id: s.vid, _findings: [] as never, _dropped: 0, _downgraded: 0, _limitations: [] as never, _model: 'm', _prompt_version: 'p', _evidence_text: null as never, _file_sha256: null as never, _sent_summary: 's' });
      expect(r.error, who).not.toBeNull();
    }
  });

  it('AI findings are readable only by the owner and same-workspace Manager; AI call log only by that workspace Admin; all immutable', async () => {
    const s = await submitted(body); await ai(s.id, fake(good));
    const expectRead: Record<string, boolean> = { creator: true, manager: true, reviewer: false, admin: false, creator2: false, admin_b: false, creator_b: false };
    for (const [who, can] of Object.entries(expectRead)) {
      const f = await c[who]!.from('findings').select('id').eq('content_id', s.id).eq('source', 'ai');
      const r = await c[who]!.from('reviews').select('id').eq('content_id', s.id).eq('source', 'ai');
      expect((f.data ?? []).length > 0, `${who} findings`).toBe(can); expect((r.data ?? []).length > 0, `${who} reviews`).toBe(can);
      const log = await c[who]!.from('ai_calls').select('id').eq('content_id', s.id);
      expect((log.data ?? []).length > 0, `${who} ai_calls`).toBe(who === 'admin');
      expect((await c[who]!.from('ai_calls').insert({ workspace_id: A, content_id: s.id, content_version_id: s.vid, requested_by: uid[who]!, provider: 'x', model: 'x', prompt_version: 'x', what_was_sent_summary: 'x', status: 'failed' })).error, `${who} insert`).not.toBeNull();
      expect((await c[who]!.from('ai_calls').update({ status: 'succeeded' }).eq('content_id', s.id).select('id')).data ?? [], `${who} update`).toHaveLength(0);
      expect((await c[who]!.from('ai_calls').delete().eq('content_id', s.id).select('id')).data ?? [], `${who} delete`).toHaveLength(0);
      expect((await c[who]!.from('findings').delete().eq('content_id', s.id).select('id')).data ?? []).toHaveLength(0);
      expect((await c[who]!.from('findings').update({ outcome: 'supported' }).eq('content_id', s.id).select('id')).data ?? []).toHaveLength(0);
    }
    // Even the server role cannot alter saved AI records.
    expect((await admin.from('findings').update({ outcome: 'supported' }).eq('content_id', s.id).eq('source', 'ai')).error).not.toBeNull();
    expect((await admin.from('ai_calls').update({ status: 'failed' }).eq('content_id', s.id)).error).not.toBeNull();
    const anon = mk(key!);
    expect((await anon.from('ai_calls').select('id').eq('content_id', s.id)).data ?? []).toHaveLength(0);
    expect((await anon.from('findings').select('id').eq('content_id', s.id)).data ?? []).toHaveLength(0);
    for (const who of ['manager', 'reviewer', 'creator']) expect((await c[who]!.from('facts').select('id').eq('workspace_id', A)).data ?? [], who).toHaveLength(0);
  });
});
