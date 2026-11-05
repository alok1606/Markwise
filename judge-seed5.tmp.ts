import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { executeChecks, aiReview } from './src/lib/content.functions';
const creds = JSON.parse(await Bun.file('/tmp/judge-demo/credentials.json').text());
const W = creds.workspace as string;
const a = creds.accounts.find((x: any) => x.role === 'creator');
const c = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
const s = await c.auth.signInWithPassword({ email: a.email, password: a.password });
if (s.error) throw s.error;
const uid = s.data.user.id;
const fail = (w: string, e: any) => { if (e) throw new Error(`${w}: ${e.message}`); };

const hId = (await c.rpc('create_content', { _workspace_id: W, _type: 'text', _title: 'Checklist tips — keep steps short', _channel: 'Intranet', _audience: 'People-operations leads', _goal: 'Share practical checklist tips', _body_text: 'A good checklist keeps each step short and clear. Everyone knows what to do first, what comes next, and who can help. Tick off steps together and celebrate a calm first week.', _alt_text: null, _text_color: null, _background_color: null })).data as string;
const sub = await c.rpc('submit_content', { _content_id: hId, _expected_version: 1 });
fail('submit', sub.error);
await executeChecks({ supabase: c as SupabaseClient, userId: uid }, W, hId, null, null);
await aiReview({ supabase: c as SupabaseClient, userId: uid }, W, hId);
const facts = await c.rpc('approval_route_facts', { _content_id: hId });
console.log('route facts:', JSON.stringify(facts.data));
if (facts.data?.route === 'manager' && (facts.data?.blocking ?? 1) === 0) {
  const r = await c.rpc('submit_for_approval', { _content_id: hId, _expected_version: 1, _reviewer_id: null });
  fail('route', r.error);
  console.log('ROUTED TO MANAGER, left open:', r.data);
} else {
  console.log('still reviewer route; left as checked.');
}
