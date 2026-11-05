// @vitest-environment node
// Live check: the AI-call log is readable only by the Admin of the same workspace. No AI is called.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const fixturePath = process.env['MARKWISE_CONTENT_FIXTURE'];
const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY']; const service = process.env['SUPABASE_SERVICE_ROLE_KEY'];

describe.skipIf(!fixturePath || !url || !key || !service)('Live AI call log access', { timeout: 120_000 }, () => {
  const c: Record<string, SupabaseClient> = {}; const uid: Record<string, string> = {}; const ids: Record<string, string> = {};
  const admin = createClient(url!, service!, { auth: { persistSession: false } });
  async function seed(creator: string, ws: string, tag: string) {
    const id = (await c[creator]!.rpc('create_content', { _workspace_id: ws, _type: 'text', _title: tag, _channel: '', _audience: '', _goal: '', _body_text: 'Private body text', _alt_text: null as never, _text_color: null as never, _background_color: null as never })).data as string;
    const vid = (await admin.from('content_versions').select('id').eq('content_id', id).single()).data!.id as string;
    const rows = Array.from({ length: 3 }, (_, i) => ({ workspace_id: ws, content_id: id, content_version_id: vid, requested_by: uid[creator]!, provider: 'test', model: `${tag}-model`, prompt_version: 'v-test', what_was_sent_summary: 'text; 17 characters of submitted text', status: i === 0 ? 'failed' : 'succeeded', error_kind: i === 0 ? 'network' : null }));
    expect((await admin.from('ai_calls').insert(rows)).error).toBeNull();
    ids[tag] = id;
  }
  beforeAll(async () => {
    const f = JSON.parse(readFileSync(fixturePath!, 'utf8')) as { workspaceA: string; workspaceB: string; accounts: { role: string; email: string; password: string }[] };
    for (const a of f.accounts) {
      const client = createClient(url!, key!, { auth: { persistSession: false } });
      const s = await client.auth.signInWithPassword({ email: a.email, password: a.password });
      if (s.error) throw new Error(`sign-in failed for ${a.role}`);
      c[a.role] = client; uid[a.role] = s.data.user!.id;
    }
    await seed('creator', f.workspaceA, 'wsa'); await seed('creator_b', f.workspaceB, 'wsb');
  });
  afterAll(async () => { for (const x of Object.values(c)) await x.auth.signOut(); });
  const read = (who: string) => c[who]!.from('ai_calls').select('model,status,what_was_sent_summary');

  it('the Admin sees only their own workspace log', async () => {
    const r = await read('admin'); expect(r.error).toBeNull();
    expect(r.data!.length).toBe(3); expect(r.data!.every(x => x.model === 'wsa-model')).toBe(true);
  });
  it('the other workspace Admin sees only theirs', async () => {
    const r = await read('admin_b'); expect(r.data!.every(x => x.model === 'wsb-model')).toBe(true); expect(r.data!.length).toBe(3);
  });
  it('the Admin cannot read the other workspace even by content id', async () => {
    expect((await c['admin']!.from('ai_calls').select('id').eq('content_id', ids['wsb']!)).data).toEqual([]);
  });
  it('status filter and pagination behave', async () => {
    expect((await read('admin').eq('status', 'failed')).data!.length).toBe(1);
    const p = await c['admin']!.from('ai_calls').select('id', { count: 'exact' }).order('created_at').range(0, 1);
    expect(p.data!.length).toBe(2); expect(p.count).toBe(3);
  });
  it('the summary never contains the submitted text', async () => {
    expect((await read('admin')).data!.some(x => x.what_was_sent_summary.includes('Private body text'))).toBe(false);
  });
  for (const who of ['manager', 'creator', 'reviewer', 'creator_b', 'reviewer_b']) {
    it(`${who} is denied`, async () => { expect((await read(who)).data ?? []).toEqual([]); });
  }
  it('nobody can change log records', async () => {
    for (const who of ['admin', 'creator']) expect((await c[who]!.from('ai_calls').update({ status: 'succeeded' }).eq('content_id', ids['wsa']!).select()).data ?? []).toEqual([]);
  });
});
