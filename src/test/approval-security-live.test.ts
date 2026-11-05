// @vitest-environment node
// Live Phase 6 security, lifecycle, routing and concurrency tests against the real database.
// The AI model is replaced by a fake caller (no AI cost). Requires MARKWISE_CONTENT_FIXTURE
// (admin, manager, reviewer, reviewer2, creator, creator2 in A; admin_b, creator_b, reviewer_b in B) and SUPABASE_SERVICE_ROLE_KEY.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runChecks, type BannedRule } from '@/lib/checks';
import { executeAiReview } from '@/lib/ai-review.server';
import { applyRewrite } from '@/lib/approval';

const fixturePath = process.env['MARKWISE_CONTENT_FIXTURE'];
const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY']; const service = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const mk = (k: string) => createClient(url!, k, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!fixturePath || !url || !key || !service)('Live Phase 6 approval workflow', { timeout: 180_000 }, () => {
  const c: Record<string, SupabaseClient> = {}; const uid: Record<string, string> = {}; let A = ''; let admin: SupabaseClient; let ruleId = '';
  const noAi = { visible_text: null, findings: [] };

  /** Creates, submits and deterministically checks text content; optionally records AI (fake) or a failed AI attempt. */
  async function prepared(text: string, ai: 'completed' | 'failed' | 'none' = 'completed', limitations: string[] = []) {
    const id = (await c['creator']!.rpc('create_content', { _workspace_id: A, _type: 'text', _title: 'P6', _channel: '', _audience: '', _goal: '', _body_text: text, _alt_text: null as never, _text_color: null as never, _background_color: null as never })).data as string;
    expect((await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 1 })).error).toBeNull();
    await check(id, limitations);
    if (ai === 'completed') await executeAiReview({ caller: c['creator']!, admin, userId: uid['creator']!, workspaceId: A, contentId: id, callModel: async () => noAi });
    if (ai === 'failed') await logFailedAi(id);
    return id;
  }
  async function check(id: string, limitations: string[] = []) {
    const row = (await admin.from('contents').select('version,body_text').eq('id', id).single()).data!;
    const vid = (await admin.from('content_versions').select('id').eq('content_id', id).eq('version_number', row.version).single()).data!.id as string;
    const rules = ((await admin.from('rules').select('id,code,title,description,severity,category,active,kind,pattern').eq('id', ruleId)).data ?? []) as BannedRule[];
    const det = runChecks({ type: 'text', body_text: row.body_text, alt_text: null, text_color: null, background_color: null, rules, glossary: [], palette: [], colour_samples: null });
    const r = await admin.rpc('record_review', { _actor: uid['creator']!, _content_id: id, _content_version_id: vid, _findings: det.findings as never, _dropped: det.dropped, _limitations: limitations as never });
    expect(r.error).toBeNull();
  }
  async function logFailedAi(id: string) {
    const row = (await admin.from('contents').select('version').eq('id', id).single()).data!;
    const vid = (await admin.from('content_versions').select('id').eq('content_id', id).eq('version_number', row.version).single()).data!.id;
    expect((await admin.from('ai_calls').insert({ workspace_id: A, content_id: id, content_version_id: vid, requested_by: uid['creator']!, provider: 'test', model: 'test', prompt_version: 'test', what_was_sent_summary: 'test', status: 'failed', error_kind: 'network' })).error).toBeNull();
  }
  const status = async (id: string) => (await admin.from('contents').select('status,version').eq('id', id).single()).data!;
  const findings = async (id: string, version: number) => {
    const vid = (await admin.from('content_versions').select('id').eq('content_id', id).eq('version_number', version).single()).data!.id;
    const rv = ((await admin.from('reviews').select('id').eq('content_version_id', vid)).data ?? []).map(r => r.id);
    return (await admin.from('findings').select('*').in('review_id', rv)).data ?? [];
  };
  const act = (id: string, version: number, finding: string, action: string, reason: string | null, finalText: string | null, body: string | null, who = 'creator') =>
    admin.rpc('act_on_finding', { _actor: uid[who]!, _content_id: id, _expected_version: version, _finding_id: finding, _action: action, _reason: reason as never, _final_text: finalText as never, _new_body: body as never });
  const send = (id: string, version: number, reviewer: string | null, who = 'creator') => c[who]!.rpc('submit_for_approval', { _content_id: id, _expected_version: version, _reviewer_id: reviewer as never });
  const decide = (approval: string, version: number, decision: string, comment: string, who: string) => c[who]!.rpc('decide_approval', { _approval_id: approval, _expected_version: version, _decision: decision, _comment: comment });
  const openApproval = async (id: string) => (await admin.from('approvals').select('*').eq('content_id', id).eq('status', 'open').maybeSingle()).data;

  beforeAll(async () => {
    const fx = JSON.parse(await readFile(fixturePath!, 'utf8')) as { workspaceA: string; accounts: { role: string; email: string; password: string }[] };
    A = fx.workspaceA; admin = mk(service!);
    for (const a of fx.accounts) { const cl = mk(key!); const s = await cl.auth.signInWithPassword({ email: a.email, password: a.password }); if (s.error) throw new Error(`${a.role}: ${s.error.message}`); c[a.role] = cl; uid[a.role] = s.data.user!.id; }
    ruleId = (await c['admin']!.from('rules').insert({ workspace_id: A, code: 'P6-R', category: 'legal', title: 'No guarantees', description: 'Never promise guaranteed results.', severity: 'critical', rule_type: 'prohibited', kind: 'banned_term', pattern: { terms: ['guaranteed'] } }).select('id').single()).data!.id;
  });
  afterAll(async () => { if (ruleId) await c['admin']?.from('rules').delete().eq('id', ruleId); });

  it('a completed deterministic review moves content to checked; clean content routes to the manager and is approved', async () => {
    const id = await prepared('Friendly onboarding for every team.');
    expect((await status(id)).status).toBe('checked');
    expect((await send(id, 1, uid['reviewer']!)).error).toBeNull(); // reviewer ID ignored on the manager route
    const a = await openApproval(id); expect(a.route).toBe('manager'); expect(a.reviewer_id).toBeNull();
    expect((await status(id)).status).toBe('pending_manager');
    // Reviewers cannot see or decide manager-routed items; creator cannot self-approve; admin denied.
    for (const who of ['reviewer', 'creator', 'admin', 'admin_b']) expect((await decide(a.id, 1, 'approved', 'ok', who)).error, who).not.toBeNull();
    expect(((await c['reviewer']!.from('contents').select('id').eq('id', id)).data ?? [])).toHaveLength(0);
    expect((await decide(a.id, 1, 'approved', '', 'manager')).error).toBeNull();
    expect((await status(id)).status).toBe('approved');
    expect((await decide(a.id, 1, 'approved', '', 'manager')).error).not.toBeNull(); // already decided
    expect((await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 1 })).error).not.toBeNull(); // final
  });

  it('claims force a named reviewer from the same workspace; only that reviewer decides, with a comment', async () => {
    const id = await prepared('We cut costs by 40% for clients.');
    expect((await send(id, 1, null)).error?.message).toMatch(/reviewer/i);
    expect((await send(id, 1, uid['reviewer_b']!)).error).not.toBeNull(); // other workspace
    expect((await send(id, 1, uid['manager']!)).error).not.toBeNull(); // not a reviewer
    expect((await send(id, 1, uid['creator']!)).error).not.toBeNull(); // self
    expect((await send(id, 1, uid['reviewer']!)).error).toBeNull();
    const a = await openApproval(id); expect(a.route).toBe('reviewer'); expect(a.reviewer_id).toBe(uid['reviewer']);
    // Assigned reviewer can read content, findings and versions; the other reviewer cannot.
    expect(((await c['reviewer']!.from('contents').select('id').eq('id', id)).data ?? [])).toHaveLength(1);
    expect(((await c['reviewer']!.from('findings').select('id').eq('content_id', id)).data ?? []).length).toBeGreaterThan(0);
    for (const who of ['reviewer2', 'reviewer_b', 'admin', 'creator2']) expect(((await c[who]!.from('contents').select('id').eq('id', id)).data ?? []), who).toHaveLength(0);
    for (const who of ['manager', 'reviewer2', 'creator']) expect((await decide(a.id, 1, 'approved', 'fine', who)).error, who).not.toBeNull();
    expect((await decide(a.id, 1, 'approved', '', 'reviewer')).error?.message).toMatch(/comment/i);
    expect((await decide(a.id, 1, 'changes_requested', 'Cite the source for 40%.', 'reviewer')).error).toBeNull();
    expect((await status(id)).status).toBe('changes_requested');
    // Manager sees it read-only.
    expect(((await c['manager']!.from('contents').select('status').eq('id', id)).data ?? [])[0]?.status).toBe('changes_requested');
    expect((await c['manager']!.rpc('save_content_draft', { _content_id: id, _expected_version: 1, _title: 'x', _channel: '', _audience: '', _goal: '', _body_text: 'x', _alt_text: null as never, _text_color: null as never, _background_color: null as never, _pdf_text_confirmed: false })).error).not.toBeNull();
    // Creator revises (new version), resubmits, recheck, new approval cycle; the old decision stays.
    const v = (await c['creator']!.rpc('save_content_draft', { _content_id: id, _expected_version: 1, _title: 'P6', _channel: '', _audience: '', _goal: '', _body_text: 'We cut costs for clients.', _alt_text: null as never, _text_color: null as never, _background_color: null as never, _pdf_text_confirmed: false })).data as number;
    expect(v).toBe(2);
    expect((await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 2 })).error).toBeNull();
    await check(id); await executeAiReview({ caller: c['creator']!, admin, userId: uid['creator']!, workspaceId: A, contentId: id, callModel: async () => noAi });
    expect((await send(id, 2, null)).error).toBeNull();
    const all = (await admin.from('approvals').select('status,version_number').eq('content_id', id).order('created_at')).data!;
    expect(all).toEqual([{ status: 'changes_requested', version_number: 1 }, { status: 'open', version_number: 2 }]);
    // The previous reviewer keeps read access to history.
    expect(((await c['reviewer']!.from('approvals').select('id').eq('content_id', id)).data ?? [])).toHaveLength(2);
  });

  it('checks with warnings: content becomes checked, needs a named reviewer, and the limitation and reason are recorded', async () => {
    const lim = 'Palette check not run: the image colours could not be read in this browser.';
    const id = await prepared('Friendly onboarding for every team.', 'completed', [lim]);
    expect((await status(id)).status).toBe('checked');
    const facts = (await c['creator']!.rpc('approval_route_facts', { _content_id: id })).data as { check_outcome: string; route: string; limitations: string[] };
    expect(facts.check_outcome).toBe('completed_with_warnings'); expect(facts.route).toBe('reviewer'); expect(facts.limitations).toEqual([lim]);
    expect((await send(id, 1, null)).error?.message).toMatch(/reviewer/i);
    expect((await send(id, 1, uid['reviewer']!)).error).toBeNull();
    const a = await openApproval(id);
    expect(a.route).toBe('reviewer'); expect(a.check_outcome).toBe('completed_with_warnings'); expect(a.check_limitations).toEqual([lim]);
    expect(a.route_reasons).toEqual(['Some automatic checks could not produce a result']);
    // Recorded routing facts cannot be altered afterwards, even by the service role.
    expect((await admin.from('approvals').update({ check_limitations: [] }).eq('id', a.id)).error).not.toBeNull();
    expect((await admin.from('reviews').select('status').eq('content_id', id).eq('source', 'deterministic').single()).data!.status).toBe('partial');
  });

  it('checks with warnings do not weaken the high/critical gate; failed checks keep sending blocked', async () => {
    const id = await prepared('Guaranteed results for every team.', 'completed', ['No colours could be read from the image.']);
    expect((await send(id, 1, uid['reviewer']!)).error?.message).toMatch(/high and critical/i);
    // Failed checking saves nothing: content stays submitted and cannot be sent until a successful retry.
    const f = (await c['creator']!.rpc('create_content', { _workspace_id: A, _type: 'text', _title: 'P6', _channel: '', _audience: '', _goal: '', _body_text: 'Calm note.', _alt_text: null as never, _text_color: null as never, _background_color: null as never })).data as string;
    expect((await c['creator']!.rpc('submit_content', { _content_id: f, _expected_version: 1 })).error).toBeNull();
    expect(((await c['creator']!.rpc('approval_route_facts', { _content_id: f })).data as { check_outcome: string }).check_outcome).toBe('failed');
    expect((await send(f, 1, uid['reviewer']!)).error).not.toBeNull();
    await check(f); expect((await status(f)).status).toBe('checked');
  });

  it('rejection is final', async () => {
    const id = await prepared('Plain update for everyone.');
    await send(id, 1, null); const a = await openApproval(id);
    expect((await decide(a.id, 1, 'rejected', '', 'manager')).error?.message).toMatch(/comment/i);
    expect((await decide(a.id, 1, 'rejected', 'Off-brand.', 'manager')).error).toBeNull();
    expect((await status(id)).status).toBe('rejected');
    expect((await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 1 })).error).not.toBeNull();
    expect((await c['creator']!.rpc('save_content_draft', { _content_id: id, _expected_version: 1, _title: 'x', _channel: '', _audience: '', _goal: '', _body_text: 'x', _alt_text: null as never, _text_color: null as never, _background_color: null as never, _pdf_text_confirmed: false })).error).not.toBeNull();
  });

  it('AI gating: pending blocks routing, failed allows it with the state recorded, late AI results are refused', async () => {
    const id = await prepared('Calm product note.', 'none');
    expect((await send(id, 1, null)).error?.message).toMatch(/AI review/i);
    await logFailedAi(id);
    expect((await send(id, 1, null)).error).toBeNull();
    expect((await openApproval(id)).ai_state_at_routing).toBe('failed');
    await expect(executeAiReview({ caller: c['creator']!, admin, userId: uid['creator']!, workspaceId: A, contentId: id, callModel: async () => noAi })).rejects.toThrow();
    const vid = (await admin.from('content_versions').select('id').eq('content_id', id).eq('version_number', 1).single()).data!.id;
    const late = await admin.rpc('record_ai_review', { _actor: uid['creator']!, _content_id: id, _content_version_id: vid, _findings: [] as never, _dropped: 0, _downgraded: 0, _limitations: [] as never, _model: 'm', _prompt_version: 'p', _evidence_text: null as never, _file_sha256: null as never, _sent_summary: 's' });
    expect(late.error).not.toBeNull();
    expect(((await admin.from('reviews').select('id').eq('content_id', id).eq('source', 'ai')).data ?? [])).toHaveLength(0);
  });

  it('finding actions: high findings block; dismissal needs a reason and keeps the finding; accept creates a rechecked version', async () => {
    const text = 'Guaranteed calm onboarding.';
    const id = await prepared(text);
    const f1 = (await findings(id, 1)).find(f => f.check_name === 'banned_term')!;
    expect(f1.severity).toBe('critical');
    expect((await send(id, 1, null)).error?.message).toMatch(/high and critical/i);
    expect((await act(id, 1, f1.id, 'dismissed', 'no', null, null)).error).not.toBeNull();
    expect((await act(id, 1, f1.id, 'dismissed', 'Legal approved this wording', null, null, 'creator2')).error).not.toBeNull(); // not owner
    // Direct calls from signed-in users are refused (service-role only).
    expect((await c['creator']!.rpc('act_on_finding', { _actor: uid['creator']!, _content_id: id, _expected_version: 1, _finding_id: f1.id, _action: 'dismissed', _reason: 'abc', _final_text: null as never, _new_body: null as never })).error).not.toBeNull();
    // Edit: new version, status submitted, recheck gives a fresh review on v2; v1 findings unchanged.
    const before = JSON.stringify(await findings(id, 1));
    const body = applyRewrite(text, f1, 'Reliable');
    expect((await act(id, 1, f1.id, 'edited', null, 'Reliable', body)).error).toBeNull();
    expect(await status(id)).toEqual({ status: 'submitted', version: 2 });
    expect((await act(id, 1, f1.id, 'dismissed', 'again please', null, null)).error).not.toBeNull(); // already resolved / stale
    await check(id); expect((await status(id)).status).toBe('checked');
    expect(JSON.stringify(await findings(id, 1))).toBe(before);
    expect((await findings(id, 2)).some(f => f.check_name === 'banned_term')).toBe(false);
    const actions = (await admin.from('finding_actions').select('*').eq('content_id', id)).data!;
    expect(actions).toHaveLength(1); expect(actions[0]!.action).toBe('edited');
    // Dismissal path on another item: finding stays, approvers see the reason.
    const id2 = await prepared('Guaranteed delivery notes.');
    const g = (await findings(id2, 1)).find(f => f.check_name === 'banned_term')!;
    expect((await act(id2, 1, g.id, 'dismissed', 'Approved wording per legal', null, null)).error).toBeNull();
    expect((await send(id2, 1, null)).error?.message).toMatch(/reviewer/i); // legal finding still routes to a reviewer
    expect((await send(id2, 1, uid['reviewer']!)).error).toBeNull();
    const seen = (await c['reviewer']!.from('finding_actions').select('reason').eq('content_id', id2)).data!;
    expect(seen[0]?.reason).toBe('Approved wording per legal');
    expect(((await c['reviewer']!.from('findings').select('id').eq('id', g.id)).data ?? [])).toHaveLength(1);
  });

  it('records are immutable and not writable through the Data API', async () => {
    const id = await prepared('Short note.');
    await send(id, 1, null); const a = await openApproval(id);
    await c['manager']!.rpc('add_comment', { _content_id: id, _parent_id: null as never, _message: 'Looks good' });
    const cm = (await admin.from('comments').select('id').eq('content_id', id).single()).data!;
    expect((await c['creator']!.rpc('add_comment', { _content_id: id, _parent_id: cm.id, _message: 'Thanks' })).error).toBeNull();
    expect((await c['admin']!.rpc('add_comment', { _content_id: id, _parent_id: null as never, _message: 'x' })).error).not.toBeNull();
    expect((await c['reviewer']!.rpc('add_comment', { _content_id: id, _parent_id: null as never, _message: 'x' })).error).not.toBeNull();
    for (const who of ['creator', 'manager']) {
      await c[who]!.from('approvals').update({ status: 'approved' }).eq('id', a.id);
      await c[who]!.from('comments').delete().eq('id', cm.id);
      expect((await c[who]!.from('approvals').insert({ workspace_id: A, content_id: id, version_id: a.version_id, version_number: 1, route: 'manager', assigned_by: uid[who]!, ai_state_at_routing: 'completed' })).error).not.toBeNull();
    }
    expect((await openApproval(id))!.status).toBe('open');
    expect((await admin.from('comments').select('id').eq('content_id', id)).data).toHaveLength(2);
    await decide(a.id, 1, 'approved', '', 'manager');
    expect((await admin.from('approvals').update({ decision_comment: 'changed' }).eq('id', a.id)).error).not.toBeNull(); // even service role
    expect((await admin.from('comments').delete().eq('id', cm.id)).error).not.toBeNull();
    const audit = (await admin.from('audit_log').select('action').eq('entity_id', id)).data!.map(x => x.action);
    for (const x of ['approval_requested', 'approval_approved', 'comment_added']) expect(audit).toContain(x);
  });

  it('concurrency: parallel decisions, parallel sends and parallel finding actions each succeed once', async () => {
    const id = await prepared('Parallel test note.');
    const sends = await Promise.all([send(id, 1, null), send(id, 1, null), send(id, 1, null)]);
    expect(sends.filter(r => !r.error)).toHaveLength(1);
    const a = await openApproval(id);
    const ds = await Promise.all([decide(a.id, 1, 'approved', '', 'manager'), decide(a.id, 1, 'rejected', 'no', 'manager'), decide(a.id, 1, 'changes_requested', 'fix', 'manager')]);
    expect(ds.filter(r => !r.error)).toHaveLength(1);
    const id2 = await prepared('Guaranteed parallel actions.');
    const g = (await findings(id2, 1)).find(f => f.check_name === 'banned_term')!;
    const body = applyRewrite('Guaranteed parallel actions.', g, 'Steady');
    const acts = await Promise.all([act(id2, 1, g.id, 'edited', null, 'Steady', body), act(id2, 1, g.id, 'dismissed', 'Reason here', null, null), act(id2, 1, g.id, 'edited', null, 'Calm', applyRewrite('Guaranteed parallel actions.', g, 'Calm'))]);
    expect(acts.filter(r => !r.error)).toHaveLength(1);
    expect((await admin.from('content_versions').select('id').eq('content_id', id2)).data!.length).toBeLessThanOrEqual(2);
  });
});
