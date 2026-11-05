import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { executeChecks, aiReview } from './src/lib/content.functions';
const creds = JSON.parse(await Bun.file('/tmp/judge-demo/credentials.json').text());
const W = creds.workspace as string;
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const a = creds.accounts.find((x: any) => x.role === 'creator');
const c = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
const s = await c.auth.signInWithPassword({ email: a.email, password: a.password });
if (s.error) throw s.error;
const uid = s.data.user.id;
const fail = (w: string, e: any) => { if (e) throw new Error(`${w}: ${e.message}`); };

// Why did D route to reviewer?
const d = await admin.from('contents').select('id').eq('workspace_id', W).eq('title', 'Intranet post — a calm first week').single();
const df = await admin.from('findings').select('category,severity,outcome,quoted_text,source').eq('content_id', d.data.id);
console.log('D findings:', JSON.stringify(df.data));

// H — manager-route open item for the judge-manager to decide
const hId = (await c.rpc('create_content', { _workspace_id: W, _type: 'text', _title: 'Team update — onboarding checklist tips', _channel: 'Intranet', _audience: 'People-operations leads', _goal: 'Share practical checklist tips with the team', _body_text: 'A good onboarding checklist keeps each step short and clear. New team members see what to do first, what comes next, and who can help. Managers can follow along and tick off steps together with their new hire.', _alt_text: null, _text_color: null, _background_color: null })).data as string;
const sub = await c.rpc('submit_content', { _content_id: hId, _expected_version: 1 });
fail('submit H', sub.error);
await executeChecks({ supabase: c as SupabaseClient, userId: uid }, W, hId, null, null);
await aiReview({ supabase: c as SupabaseClient, userId: uid }, W, hId);
const facts = await c.rpc('approval_route_facts', { _content_id: hId });
console.log('H route facts:', JSON.stringify(facts.data));
if (facts.data?.route === 'manager' && (facts.data?.blocking ?? 1) === 0) {
  const r = await c.rpc('submit_for_approval', { _content_id: hId, _expected_version: 1, _reviewer_id: null });
  fail('route H', r.error);
  const ap = await admin.from('approvals').select('id,route,status').eq('id', r.data).single();
  console.log('H routed:', JSON.stringify(ap.data));
} else {
  console.log('H NOT routed (would not be a clean manager item); left as checked.');
}
