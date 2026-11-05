// TEMPORARY judge-demo seeding script — drives the real Markwise pipeline with the judge demo
// accounts so every review/finding/approval is genuine system output. Deleted after use; never committed.
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

const out: Record<string, unknown> = {};
const fail = (where: string, e: { message: string } | null) => { if (e) throw new Error(`${where}: ${e.message}`); };

async function createText(title: string, body: string, channel: string, goal: string) {
  const r = await creator.c.rpc('create_content', { _workspace_id: W, _type: 'text', _title: title, _channel: channel, _audience: 'People-operations leads at growing companies', _goal: goal, _body_text: body, _alt_text: null, _text_color: null, _background_color: null });
  fail(`create ${title}`, r.error);
  return r.data as string;
}
async function submit(id: string, samples: { hex: string; share: number }[] | null = null, imageError: string | null = null) {
  const s = await creator.c.rpc('submit_content', { _content_id: id, _expected_version: 1 });
  fail('submit', s.error);
  const ctx = { supabase: creator.c, userId: creator.uid };
  const checks = await executeChecks(ctx, W, id, samples, imageError);
  return checks;
}
async function ai(id: string) {
  return aiReview({ supabase: creator.c, userId: creator.uid }, W, id);
}
async function route(id: string, withReviewer: boolean) {
  const r = await creator.c.rpc('submit_for_approval', { _content_id: id, _expected_version: 1, _reviewer_id: withReviewer ? reviewer.uid : null });
  fail('route', r.error);
  const a = await admin.from('approvals').select('id,route').eq('id', r.data).single();
  return a.data as { id: string; route: string };
}
async function decide(approvalId: string, routeKind: string, decision: string, comment: string) {
  const who = routeKind === 'reviewer' ? reviewer : manager;
  const r = await who.c.rpc('decide_approval', { _approval_id: approvalId, _expected_version: 1, _decision: decision, _comment: comment });
  fail(`decide ${decision}`, r.error);
}

// A — DRAFT (judges can edit and submit it themselves)
const aId = await createText(
  'Welcome email — new team members (judges can edit me)',
  'Hello and welcome! Your first week with us starts with a short checklist: meet your onboarding buddy, set up your tools, and join the Friday introduction call. Your manager will walk you through each step.',
  'Email', 'Give new team members a calm, clear first-week plan');
out.draft = aId;

// B — CHECKED with open findings (deterministic + AI)
const bId = await createText(
  'Launch announcement — onboarding results',
  'We cut onboarding time by 60%, guaranteed! Our clients say it is the best-in-class onboarding tool.',
  'Website', 'Announce onboarding results');
out.checked = { id: bId, checks: await submit(bId) };
(out.checked as any).ai = await ai(bId);

// C — PENDING_REVIEWER (claim/legal reasons force reviewer route)
const cId = await createText(
  'Customer email — rollout plan',
  'Nimbus Onboard reduces onboarding time by up to 40%. A risk-free rollout for your team, set up in one day.',
  'Email', 'Explain the rollout plan to a prospective customer');
out.pending = { id: cId, checks: await submit(cId) };
(out.pending as any).ai = await ai(cId);
const cAppr = await route(cId, true);
(out.pending as any).approval = cAppr;
const cmt = await reviewer.c.rpc('add_comment', { _content_id: cId, _parent_id: null, _message: 'Please double-check the "risk-free" wording against our legal rules before I decide.' });
fail('comment C', cmt.error);

// D — APPROVED (aiming for manager route: no numbers, no claims)
const dId = await createText(
  'Intranet post — a calm first week',
  'A calm first week starts with a clear plan. Nimbus Onboard keeps every onboarding step organised, so new team members know what to do and when.',
  'Intranet', 'Introduce the onboarding approach internally');
out.approved = { id: dId, checks: await submit(dId) };
(out.approved as any).ai = await ai(dId);
const dAppr = await route(dId, true);
await decide(dAppr.id, dAppr.route, 'approved', dAppr.route === 'reviewer' ? 'Clean and on-brand. Approved.' : '');
(out.approved as any).approval = dAppr;
const dCmt = await manager.c.rpc('add_comment', { _content_id: dId, _parent_id: null, _message: 'Nice, calm tone — this is exactly the voice we want.' });
fail('comment D', dCmt.error);

// E — CHANGES_REQUESTED (reviewer route)
const eId = await createText(
  'Social post — product praise',
  'Nimbus Onboard is the number one onboarding platform, loved by customers everywhere.',
  'Social media', 'Promote the product on social channels');
out.changes = { id: eId, checks: await submit(eId) };
(out.changes as any).ai = await ai(eId);
const eAppr = await route(eId, true);
await decide(eAppr.id, eAppr.route, 'changes_requested', 'Please remove the unverifiable superlative and resubmit.');
(out.changes as any).approval = eAppr;

// F — REJECTED (terminal, reviewer route)
const fId = await createText(
  'Ad copy — guarantee (rejected example)',
  'We guarantee results: your team will never miss a step, risk-free and guaranteed.',
  'Paid ads', 'Acquire new customers');
out.rejected = { id: fId, checks: await submit(fId) };
(out.rejected as any).ai = await ai(fId);
const fAppr = await route(fId, true);
await decide(fAppr.id, fAppr.route, 'rejected', 'Outcome guarantees are against our legal rules. This cannot be published.');
(out.rejected as any).approval = fAppr;

// G — IMAGE with visual checks (alt text, contrast, palette); AI review left for judges to run live
const gId = await creator.c.rpc('create_content', { _workspace_id: W, _type: 'image', _title: 'Homepage hero graphic', _channel: 'Website', _audience: 'People-operations leads', _goal: 'Hero illustration for the homepage', _body_text: null, _alt_text: 'Navy header reading "Nimbus Onboard" above a teal panel with the text "A calm first week for every new team member".', _text_color: '#F8FAFC', _background_color: '#1F2A44' });
fail('create image', gId.error);
const imgId = gId.data as string;
const png = new Uint8Array(await Bun.file('/tmp/judge-demo/hero.png').arrayBuffer());
const path = `${W}/${imgId}/${crypto.randomUUID()}.png`;
const up = await creator.c.storage.from('content-files').upload(path, png, { contentType: 'image/png' });
fail('upload image', up.error as never);
const sf = await admin.rpc('set_content_file', { _actor: creator.uid, _content_id: imgId, _expected_version: 1, _file_path: path, _file_name: 'hero.png', _file_mime: 'image/png', _file_size: png.byteLength });
fail('register image', sf.error);
out.image = { id: imgId, checks: await submit(imgId, [{ hex: '#1F2A44', share: 0.4 }, { hex: '#F8FAFC', share: 0.35 }, { hex: '#0F766E', share: 0.25 }]) };

await Bun.write('/tmp/judge-demo/seed-result.json', JSON.stringify(out, null, 2));
console.log('SEED OK');
for (const [k, v] of Object.entries(out)) console.log(k, (v as any).id ?? v);
