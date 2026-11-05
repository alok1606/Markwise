// TEMPORARY judge-demo seeding script, part 2 — resumes C, creates D–G. Deleted after use; never committed.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { executeChecks, aiReview } from './src/lib/content.functions';

const URL = process.env.SUPABASE_URL!;
const PUB = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const creds = JSON.parse(await Bun.file('/tmp/judge-demo/credentials.json').text());
const W = creds.workspace as string;
const admin = createClient(URL, SVC, { auth: { persistSession: false } });

type U = { c: SupabaseClient; uid: string };
async function signIn(role: string): Promise<U> {
  const a = creds.accounts.find((x: any) => x.role === role);
  const c = createClient(URL, PUB, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email: a.email, password: a.password });
  if (s.error) throw s.error;
  return { c: c as SupabaseClient, uid: s.data.user.id };
}
const creator = await signIn('creator');
const manager = await signIn('manager');
const reviewer = await signIn('reviewer');

const fail = (where: string, e: { message: string } | null) => { if (e) throw new Error(`${where}: ${e.message}`); };
const out: Record<string, unknown> = {};

async function contentByTitle(title: string) {
  const r = await admin.from('contents').select('id,status,version,body_text').eq('workspace_id', W).eq('title', title).is('deleted_at', null).maybeSingle();
  fail(`find ${title}`, r.error);
  return r.data;
}
async function createText(title: string, body: string, channel: string, goal: string) {
  const r = await creator.c.rpc('create_content', { _workspace_id: W, _type: 'text', _title: title, _channel: channel, _audience: 'People-operations leads at growing companies', _goal: goal, _body_text: body, _alt_text: null, _text_color: null, _background_color: null });
  fail(`create ${title}`, r.error);
  return r.data as string;
}
async function submit(id: string, version: number, samples: { hex: string; share: number }[] | null = null) {
  const s = await creator.c.rpc('submit_content', { _content_id: id, _expected_version: version });
  fail('submit', s.error);
  return executeChecks({ supabase: creator.c, userId: creator.uid }, W, id, samples, null);
}
const ai = (id: string) => aiReview({ supabase: creator.c, userId: creator.uid }, W, id);

async function blockingFindings(id: string, version: number) {
  const v = await admin.from('content_versions').select('id').eq('content_id', id).eq('version_number', version).single();
  const r = await admin.from('reviews').select('id').eq('content_version_id', v.data!.id);
  const ids = (r.data ?? []).map(x => x.id);
  if (!ids.length) return [];
  const f = await admin.from('findings').select('id,severity,outcome,quoted_text,suggested_text,source').in('review_id', ids).in('severity', ['high', 'critical']).neq('outcome', 'supported');
  const acts = await admin.from('finding_actions').select('finding_id').in('finding_id', (f.data ?? []).map(x => x.id));
  const done = new Set((acts.data ?? []).map(x => x.finding_id));
  return (f.data ?? []).filter(x => !done.has(x.id));
}
async function act(id: string, version: number, findingId: string, action: string, reason: string | null, finalText: string | null, newBody: string | null) {
  const r = await admin.rpc('act_on_finding', { _actor: creator.uid, _content_id: id, _expected_version: version, _finding_id: findingId, _action: action, _reason: reason, _final_text: finalText, _new_body: newBody });
  fail(`act ${action}`, r.error);
  return r.data as number;
}
async function route(id: string, version: number) {
  const r = await creator.c.rpc('submit_for_approval', { _content_id: id, _expected_version: version, _reviewer_id: reviewer.uid });
  fail('route', r.error);
  const a = await admin.from('approvals').select('id,route').eq('id', r.data).single();
  return a.data as { id: string; route: string };
}
async function decide(approvalId: string, routeKind: string, version: number, decision: string, comment: string) {
  const who = routeKind === 'reviewer' ? reviewer : manager;
  const r = await who.c.rpc('decide_approval', { _approval_id: approvalId, _expected_version: version, _decision: decision, _comment: comment });
  fail(`decide ${decision}`, r.error);
}

// ---- C: resume — edit "risk-free" -> "smooth", recheck, dismiss the verified 40% claim, route to reviewer
const C = (await contentByTitle('Customer email — rollout plan'))!;
let cVer = C.version as number;
let cBody = C.body_text as string;
const cBlock = await blockingFindings(C.id, cVer);
const cRisk = cBlock.find(f => /risk-free/i.test(f.quoted_text));
if (cRisk) {
  const newBody = cBody.replace(/risk-free/i, 'smooth');
  cVer = await act(C.id, cVer, cRisk.id, 'edited', null, 'smooth', newBody);
  await executeChecks({ supabase: creator.c, userId: creator.uid }, W, C.id, null, null);
  await ai(C.id);
}
for (const f of await blockingFindings(C.id, cVer)) {
  await act(C.id, cVer, f.id, 'dismissed', 'Matches approved fact FACT-014 (up to 40%, 2025 customer study); confirmed by the AI review.', null, null);
}
const cAppr = await route(C.id, cVer);
const cmt = await reviewer.c.rpc('add_comment', { _content_id: C.id, _parent_id: null, _message: 'Please double-check the wording against our legal rules before I decide.' });
fail('comment C', cmt.error);
out.pending = { id: C.id, version: cVer, approval: cAppr };

// ---- D: APPROVED — claim-free text, aiming for manager route (falls back to reviewer if the AI adds claim findings)
const dId = await createText('Intranet post — a calm first week',
  'A calm first week starts with a clear plan. Nimbus Onboard keeps every onboarding step organised, so new team members know what to do and when.',
  'Intranet', 'Introduce the onboarding approach internally');
await submit(dId, 1);
await ai(dId);
for (const f of await blockingFindings(dId, 1)) {
  await act(dId, 1, f.id, 'dismissed', 'Reviewed against the knowledge base; no action needed for this item.', null, null);
}
const dAppr = await route(dId, 1);
await decide(dAppr.id, dAppr.route, 1, 'approved', dAppr.route === 'reviewer' ? 'Clean and on-brand. Approved.' : '');
const dCmt = await manager.c.rpc('add_comment', { _content_id: dId, _parent_id: null, _message: 'Nice, calm tone — this is exactly the voice we want.' });
fail('comment D', dCmt.error);
out.approved = { id: dId, approval: dAppr };

// ---- E: CHANGES_REQUESTED — medium superlative, reviewer route
const eId = await createText('Social post — product praise',
  'Nimbus Onboard is the number one onboarding platform, loved by customers everywhere.',
  'Social media', 'Promote the product on social channels');
await submit(eId, 1);
await ai(eId);
for (const f of await blockingFindings(eId, 1)) {
  await act(eId, 1, f.id, 'dismissed', 'Reviewed against the knowledge base; keeping this wording for now.', null, null);
}
const eAppr = await route(eId, 1);
await decide(eAppr.id, eAppr.route, 1, 'changes_requested', 'Please remove the unverifiable superlative and resubmit.');
out.changes = { id: eId, approval: eAppr };

// ---- F: REJECTED — creator dismisses the legal findings (visible in the audit trail), reviewer rejects
const fId = await createText('Ad copy — guarantee (rejected example)',
  'We guarantee results: your team will never miss a step, risk-free and guaranteed.',
  'Paid ads', 'Acquire new customers');
await submit(fId, 1);
await ai(fId);
for (const f of await blockingFindings(fId, 1)) {
  await act(fId, 1, f.id, 'dismissed', 'Marketing insists on this wording for the campaign.', null, null);
}
const fAppr = await route(fId, 1);
await decide(fAppr.id, fAppr.route, 1, 'rejected', 'Outcome guarantees are against our legal rules. This cannot be published.');
out.rejected = { id: fId, approval: fAppr };

// ---- G: IMAGE with visual checks; AI review left for judges to run live
const gId = await creator.c.rpc('create_content', { _workspace_id: W, _type: 'image', _title: 'Homepage hero graphic', _channel: 'Website', _audience: 'People-operations leads', _goal: 'Hero illustration for the homepage', _body_text: null, _alt_text: 'Navy header reading "Nimbus Onboard" above a teal panel with the text "A calm first week for every new team member".', _text_color: '#F8FAFC', _background_color: '#1F2A44' });
fail('create image', gId.error);
const imgId = gId.data as string;
const png = new Uint8Array(await Bun.file('/tmp/judge-demo/hero.png').arrayBuffer());
const path = `${W}/${imgId}/${crypto.randomUUID()}.png`;
const up = await creator.c.storage.from('content-files').upload(path, png, { contentType: 'image/png' });
fail('upload image', up.error as never);
const sf = await admin.rpc('set_content_file', { _actor: creator.uid, _content_id: imgId, _expected_version: 1, _file_path: path, _file_name: 'hero.png', _file_mime: 'image/png', _file_size: png.byteLength });
fail('register image', sf.error);
out.image = { id: imgId, checks: await submit(imgId, 1, [{ hex: '#1F2A44', share: 0.4 }, { hex: '#F8FAFC', share: 0.35 }, { hex: '#0F766E', share: 0.25 }]) };

await Bun.write('/tmp/judge-demo/seed-result2.json', JSON.stringify(out, null, 2));
console.log('SEED2 OK');
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
