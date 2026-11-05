// @vitest-environment node
// Live Phase 4 security tests for automatic-check reviews and findings.
// Requires MARKWISE_CONTENT_FIXTURE (same private JSON as the Phase 3 suite: admin, manager, reviewer, creator, creator2 in A; admin_b, creator_b in B)
// and SUPABASE_SERVICE_ROLE_KEY, used only to play the server's role when recording a review (exactly as the app server does).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runChecks, type BannedRule } from '@/lib/checks';

const fixturePath = process.env['MARKWISE_CONTENT_FIXTURE'];
const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY']; const service = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const mk = (k: string) => createClient(url!, k, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!fixturePath || !url || !key || !service)('Live Phase 4 review and findings security', { timeout: 90_000 }, () => {
  const c: Record<string, SupabaseClient> = {}; const uid: Record<string, string> = {}; let A = ''; let B = ''; let admin: SupabaseClient;
  let ruleA = ''; let ruleB = ''; let contentId = ''; let versionId = '';
  const body = 'Guaranteed onboarding for clients, 40% faster. 🚀 guaranteed.';

  async function createSubmitted(role: string, ws: string, text: string) {
    const id = (await c[role]!.rpc('create_content', { _workspace_id: ws, _type: 'text', _title: 'Checks', _channel: '', _audience: '', _goal: '', _body_text: text, _alt_text: null as never, _text_color: null as never, _background_color: null as never })).data as string;
    expect((await c[role]!.rpc('submit_content', { _content_id: id, _expected_version: 1 })).error).toBeNull();
    const v = (await c[role]!.from('content_versions').select('id').eq('content_id', id).eq('version_number', 1).single()).data!;
    return { id, vid: v.id as string };
  }
  async function kb(ws: string) {
    const [r, g] = await Promise.all([
      admin.from('rules').select('id,code,title,description,severity,category,active,kind,pattern').eq('workspace_id', ws).eq('active', true).eq('kind', 'banned_term'),
      admin.from('glossary').select('id,preferred_term,avoided_terms,case_sensitive,note').eq('workspace_id', ws)]);
    // Use only this suite's own records so other data in the workspace cannot change the expected counts.
    return { rules: (r.data as BannedRule[]).filter(x => x.code === 'P4-LEGAL'), glossary: (g.data ?? []).filter(x => x.preferred_term === 'customers') };
  }
  const record = (actor: string, id: string, vid: string, findings: unknown[], dropped = 0, lim: string[] = []) =>
    admin.rpc('record_review', { _actor: actor, _content_id: id, _content_version_id: vid, _findings: findings as never, _dropped: dropped, _limitations: lim as never });

  beforeAll(async () => {
    const fx = JSON.parse(await readFile(fixturePath!, 'utf8')) as { workspaceA: string; workspaceB: string; accounts: { role: string; email: string; password: string }[] };
    A = fx.workspaceA; B = fx.workspaceB; admin = mk(service!);
    for (const a of fx.accounts) { const cl = mk(key!); const s = await cl.auth.signInWithPassword({ email: a.email, password: a.password }); if (s.error) throw new Error(`${a.role}: ${s.error.message}`); c[a.role] = cl; uid[a.role] = s.data.user!.id; }
    ruleA = (await c['admin']!.from('rules').insert({ workspace_id: A, code: 'P4-LEGAL', category: 'legal', title: 'No guarantees', description: 'Do not say guaranteed', severity: 'critical', rule_type: 'prohibited', kind: 'banned_term', pattern: { terms: ['guaranteed'] } }).select('id').single()).data!.id;
    await c['admin']!.from('glossary').insert({ workspace_id: A, preferred_term: 'customers', avoided_terms: ['clients'] });
    ruleB = (await c['admin_b']!.from('rules').insert({ workspace_id: B, code: 'P4-B', category: 'legal', title: 'B rule', description: 'B', severity: 'high', rule_type: 'prohibited', kind: 'banned_term', pattern: { terms: ['onboarding'] } }).select('id').single()).data!.id;
    const s = await createSubmitted('creator', A, body); contentId = s.id; versionId = s.vid;
  });
  afterAll(async () => {
    await c['admin']?.from('glossary').delete().eq('workspace_id', A).eq('preferred_term', 'customers');
    await c['admin']?.from('rules').delete().eq('id', ruleA); await c['admin_b']?.from('rules').delete().eq('id', ruleB);
  });

  it('records findings for the exact submitted version, atomically, with workspace-valid citations', async () => {
    const k = await kb(A);
    const res = runChecks({ type: 'text', body_text: body, alt_text: null, text_color: null, background_color: null, ...k, palette: [], colour_samples: null });
    expect(res.findings.map(f => f.check_name).sort()).toEqual(['banned_term', 'banned_term', 'numeric_claim', 'terminology']);
    for (const f of res.findings) expect(body.slice(f.span_start!, f.span_end!)).toBe(f.quoted_text);
    const r = await record(uid['creator']!, contentId, versionId, res.findings);
    expect(r.error).toBeNull();
    const rv = (await c['creator']!.from('reviews').select('content_version_id,finding_count,status').eq('content_id', contentId).single()).data!;
    expect(rv).toEqual({ content_version_id: versionId, finding_count: 4, status: 'completed' });
    const claim = (await c['creator']!.from('findings').select('outcome').eq('content_id', contentId).eq('check_name', 'numeric_claim').single()).data!;
    expect(claim.outcome).toBe('cannot_verify');
  });
  it('refuses a second review of the same version', async () => {
    expect((await record(uid['creator']!, contentId, versionId, [])).error?.message).toMatch(/already ran/);
  });
  it('writes an audit event', async () => {
    const a = await admin.from('audit_log').select('action,metadata').eq('entity_id', contentId).eq('action', 'review_completed');
    expect(a.data).toHaveLength(1); expect((a.data![0]!.metadata as { findings: number }).findings).toBe(4);
  });
  it('rolls back completely when any finding is invalid (cross-workspace citation)', async () => {
    const s = await createSubmitted('creator', A, 'onboarding');
    const bad = { check_name: 'banned_term', category: 'legal', severity: 'high', confidence: 1, span_start: 0, span_end: 10, quoted_text: 'onboarding', explanation: 'x', cited_kind: 'rule', cited_id: ruleB, cited_code: 'P4-B', cited_passage: '', outcome: 'violation' };
    const good = { ...bad, cited_id: ruleA, cited_code: 'P4-LEGAL' };
    expect((await record(uid['creator']!, s.id, s.vid, [good, bad])).error?.message).toMatch(/outside this workspace/);
    expect((await admin.from('reviews').select('id').eq('content_id', s.id)).data).toEqual([]);
    expect((await admin.from('findings').select('id').eq('content_id', s.id)).data).toEqual([]);
  });
  it('refuses drafts, wrong versions, other owners and non-creators', async () => {
    const d = (await c['creator']!.rpc('create_content', { _workspace_id: A, _type: 'text', _title: 'd', _channel: '', _audience: '', _goal: '', _body_text: 'x', _alt_text: null as never, _text_color: null as never, _background_color: null as never })).data as string;
    const dv = (await c['creator']!.from('content_versions').select('id').eq('content_id', d).single()).data!.id;
    expect((await record(uid['creator']!, d, dv, [])).error?.message).toMatch(/submitted content/);
    const s = await createSubmitted('creator', A, 'x');
    expect((await record(uid['creator']!, s.id, dv, [])).error?.message).toMatch(/exact submitted version/);
    expect((await record(uid['creator2']!, s.id, s.vid, [])).error?.message).toMatch(/not found/);
    expect((await record(uid['manager']!, s.id, s.vid, [])).error?.message).toMatch(/not found/);
    await c['creator']!.rpc('delete_content_draft', { _content_id: d });
  });
  it('signed-in users cannot call the recording function', async () => {
    for (const r of ['creator', 'manager', 'reviewer', 'admin']) expect((await c[r]!.rpc('record_review', { _actor: uid['creator']!, _content_id: contentId, _content_version_id: versionId, _findings: [] as never, _dropped: 0, _limitations: [] as never })).error).not.toBeNull();
  });
  it('findings and reviews cannot be inserted, updated or deleted by any role', async () => {
    const f = (await admin.from('findings').select('id,review_id').eq('content_id', contentId).limit(1).single()).data!;
    for (const r of ['creator', 'manager', 'reviewer', 'admin', 'creator_b']) {
      expect((await c[r]!.from('findings').update({ explanation: 'x' }).eq('id', f.id).select('id')).data ?? []).toEqual([]);
      expect((await c[r]!.from('findings').delete().eq('id', f.id).select('id')).data ?? []).toEqual([]);
      expect((await c[r]!.from('findings').insert({ review_id: f.review_id, content_id: contentId, workspace_id: A, check_name: 'alt_text', category: 'x', severity: 'low', confidence: 1, explanation: 'x', cited_kind: 'spec', outcome: 'violation' })).error).not.toBeNull();
      expect((await c[r]!.from('reviews').update({ status: 'partial' }).eq('content_id', contentId).select('id')).data ?? []).toEqual([]);
      expect((await c[r]!.from('reviews').delete().eq('content_id', contentId).select('id')).data ?? []).toEqual([]);
    }
    expect((await admin.from('findings').update({ explanation: 'x' }).eq('id', f.id)).error?.message).toMatch(/immutable/);
    expect((await admin.from('findings').select('id').eq('content_id', contentId)).data).toHaveLength(4);
  });
  it('only the owner and workspace Managers can read findings', async () => {
    const n = async (r: string) => ((await c[r]!.from('findings').select('id').eq('content_id', contentId)).data ?? []).length;
    const rv = async (r: string) => ((await c[r]!.from('reviews').select('id').eq('content_id', contentId)).data ?? []).length;
    expect(await n('creator')).toBe(4); expect(await n('manager')).toBe(4);
    for (const r of ['creator2', 'reviewer', 'admin', 'admin_b', 'creator_b']) { expect(await n(r)).toBe(0); expect(await rv(r)).toBe(0); }
  });
  it('signed-out visitors have no access to reviews or findings', async () => {
    const anon = mk(key!);
    expect((await anon.from('findings').select('id').limit(1)).error).not.toBeNull();
    expect((await anon.from('reviews').select('id').limit(1)).error).not.toBeNull();
  });
  it('the Knowledge Base stays Admin-only for non-Admin roles', async () => {
    for (const r of ['creator', 'manager', 'reviewer']) { expect((await c[r]!.from('rules').select('id').eq('workspace_id', A)).data ?? []).toEqual([]); expect((await c[r]!.from('glossary').select('id').eq('workspace_id', A)).data ?? []).toEqual([]); }
  });
});
