// @vitest-environment node
// Live check that every source the Activity tab reads is limited by existing content permissions.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const fixturePath = process.env['MARKWISE_CONTENT_FIXTURE'];
const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
const SOURCES = ['content_versions', 'finding_actions', 'approvals', 'comments'] as const;

describe.skipIf(!fixturePath || !url || !key)('Live Activity tab data access', { timeout: 120_000 }, () => {
  const c: Record<string, SupabaseClient> = {}; let id = '';
  const count = async (role: string) => Object.fromEntries(await Promise.all(SOURCES.map(async t => [t, ((await c[role]!.from(t).select('id').eq('content_id', id)).data ?? []).length])));

  beforeAll(async () => {
    const f = JSON.parse(readFileSync(fixturePath!, 'utf8')) as { workspaceA: string; accounts: { role: string; email: string; password: string }[] };
    for (const a of f.accounts) {
      const client = createClient(url!, key!, { auth: { persistSession: false } });
      const s = await client.auth.signInWithPassword({ email: a.email, password: a.password });
      if (s.error) throw new Error(`sign-in failed for ${a.role}`);
      c[a.role] = client;
    }
    id = (await c['creator']!.rpc('create_content', { _workspace_id: f.workspaceA, _type: 'text', _title: 'Activity', _channel: '', _audience: '', _goal: '', _body_text: 'Hello', _alt_text: null as never, _text_color: null as never, _background_color: null as never })).data as string;
    expect((await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 1 })).error).toBeNull();
    expect((await c['creator']!.rpc('add_comment', { _content_id: id, _parent_id: null as never, _message: 'Activity test' })).error).toBeNull();
  });
  afterAll(async () => { for (const x of Object.values(c)) await x.auth.signOut(); });

  it('the owner Creator sees versions and comments', async () => {
    const r = await count('creator'); expect(r['content_versions']).toBeGreaterThan(0); expect(r['comments']).toBe(1);
  });
  it('a Manager in the workspace sees submitted content activity', async () => {
    const r = await count('manager'); expect(r['content_versions']).toBeGreaterThan(0); expect(r['comments']).toBe(1);
  });
  for (const role of ['reviewer', 'creator2', 'admin', 'admin_b', 'creator_b', 'reviewer_b']) {
    it(`${role} sees no activity (unassigned, other creator, Admin or other workspace)`, async () => {
      expect(await count(role)).toEqual({ content_versions: 0, finding_actions: 0, approvals: 0, comments: 0 });
    });
  }
});
