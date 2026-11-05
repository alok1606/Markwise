import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { executeChecks } from './src/lib/content.functions';
const creds = JSON.parse(await Bun.file('/tmp/judge-demo/credentials.json').text());
const W = creds.workspace as string;
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const a = creds.accounts.find((x: any) => x.role === 'creator');
const c = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
const s = await c.auth.signInWithPassword({ email: a.email, password: a.password });
if (s.error) throw s.error;
const g = await admin.from('contents').select('id,version').eq('workspace_id', W).eq('title', 'Homepage hero graphic').single();
const sub = await c.rpc('submit_content', { _content_id: g.data.id, _expected_version: g.data.version });
if (sub.error) throw new Error(sub.error.message);
const checks = await executeChecks({ supabase: c as SupabaseClient, userId: s.data.user.id }, W, g.data.id,
  [{ hex: '#1F2A44', share: 0.4 }, { hex: '#F8FAFC', share: 0.35 }, { hex: '#0F766E', share: 0.25 }], null);
console.log('image checks ok', JSON.stringify(checks));
