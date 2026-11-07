// @vitest-environment node
// Live four-role check of migration 0019 against existing records. Writes nothing: every write
// attempt below must be refused. MARKWISE_ROLE_FIXTURE is a private JSON file:
// { workspace, foreign, accounts: { creator|manager|reviewer|admin: { email, password } } }
// where all four accounts belong to `workspace` and none belong to `foreign`.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readAdminReviews } from '@/lib/admin-reviews';

const fixturePath = process.env['MARKWISE_ROLE_FIXTURE'];
const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
const ROLES = ['creator', 'manager', 'reviewer', 'admin'] as const;
const TABLES = ['contents', 'content_versions', 'reviews', 'findings', 'approvals', 'finding_actions', 'comments'] as const;
const mk = () => createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!fixturePath || !url || !key)('Admin read-only reviews: four roles and workspace isolation', { timeout: 120_000 }, () => {
  const c: Record<string, SupabaseClient> = {}; const uid: Record<string, string> = {};
  let W = ''; let F = '';
  const ids = async (who: string, table: string, col = 'content_id') =>
    new Set(((await c[who]!.from(table).select(col).eq('workspace_id', W)).data ?? []).map(r => (r as unknown as Record<string, string>)[col]));

  beforeAll(async () => {
    const f = JSON.parse(readFileSync(fixturePath!, 'utf8')) as { workspace: string; foreign: string; accounts: Record<string, { email: string; password: string }> };
    W = f.workspace; F = f.foreign;
    for (const role of ROLES) {
      const client = mk();
      const s = await client.auth.signInWithPassword(f.accounts[role]!);
      if (s.error || !s.data.user) throw new Error(`sign-in failed for ${role}`);
      c[role] = client; uid[role] = s.data.user.id;
    }
  });
  afterAll(async () => { for (const x of Object.values(c)) await x.auth.signOut(); });

  it('Admin sees every reviewed item in the workspace, and only reviewed items', async () => {
    const adminContents = await ids('admin', 'contents', 'id');
    const adminReviewed = await ids('admin', 'reviews');
    expect(adminContents.size).toBeGreaterThan(0);
    expect([...adminContents].sort()).toEqual([...adminReviewed].sort());
    // Items the owner Creator can see but that were never checked stay hidden from Admin.
    const creatorContents = await ids('creator', 'contents', 'id');
    const creatorReviewed = await ids('creator', 'reviews');
    for (const id of creatorContents) expect(adminContents.has(id), id).toBe(creatorReviewed.has(id));
    expect((await readAdminReviews(c['admin']!, W)).length).toBe(adminContents.size);
  });

  it('Admin can read findings, versions and approval history for reviewed items', async () => {
    for (const t of ['findings', 'content_versions', 'approvals']) expect((await ids('admin', t)).size, t).toBeGreaterThan(0);
  });

  it('Admin can open files of reviewed items', async () => {
    const withFile = ((await c['admin']!.from('contents').select('file_path').eq('workspace_id', W).not('file_path', 'is', null)).data ?? [])[0];
    if (!withFile?.file_path) return;
    expect((await c['admin']!.storage.from('content-files').createSignedUrl(withFile.file_path, 60)).error).toBeNull();
  });

  it('Admin cannot write, comment, approve, reject or request changes', async () => {
    const admin = c['admin']!;
    const item = ((await admin.from('contents').select('id,title,version,workspace_id').eq('workspace_id', W).limit(1)).data ?? [])[0]!;
    const open = ((await admin.from('approvals').select('id,version_number').eq('workspace_id', W).eq('status', 'open').limit(1)).data ?? [])[0];
    expect((await admin.rpc('add_comment', { _content_id: item.id, _parent_id: null as never, _message: 'admin should be refused' })).error).not.toBeNull();
    if (open) for (const decision of ['approved', 'rejected', 'changes_requested'])
      expect((await admin.rpc('decide_approval', { _approval_id: open.id, _expected_version: open.version_number, _decision: decision, _comment: 'refused' })).error, decision).not.toBeNull();
    expect((await admin.rpc('submit_content', { _content_id: item.id, _expected_version: item.version })).error).not.toBeNull();
    expect((await admin.rpc('create_content', { _workspace_id: W, _type: 'text', _title: 'x', _channel: '', _audience: '', _goal: '', _body_text: 'x', _alt_text: null as never, _text_color: null as never, _background_color: null as never })).error).not.toBeNull();
    expect((await admin.from('comments').insert({ workspace_id: W, content_id: item.id, author_id: uid['admin']!, message: 'x' })).error).not.toBeNull();
    const upd = await admin.from('contents').update({ title: 'tampered' }).eq('id', item.id).select('id');
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    const del = await admin.from('reviews').delete().eq('content_id', item.id).select('id');
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    expect(((await admin.from('contents').select('title').eq('id', item.id).single()).data!).title).toBe(item.title);
  });

  it('Creator still sees only their own content', async () => {
    const rows = (await c['creator']!.from('contents').select('owner_id').eq('workspace_id', W)).data ?? [];
    for (const r of rows) expect(r.owner_id).toBe(uid['creator']);
  });

  it('Manager still sees submitted (non-draft) content only', async () => {
    const rows = (await c['manager']!.from('contents').select('status').eq('workspace_id', W)).data ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.status).not.toBe('draft');
  });

  it('Reviewer still sees only content assigned to them', async () => {
    const rows = (await c['reviewer']!.from('contents').select('id').eq('workspace_id', W)).data ?? [];
    for (const r of rows) {
      const mine = (await c['reviewer']!.from('approvals').select('id').eq('content_id', r.id).eq('reviewer_id', uid['reviewer']!)).data ?? [];
      expect(mine.length, r.id).toBeGreaterThan(0);
    }
  });

  for (const role of ROLES) {
    it(`${role} cannot read another workspace's content or review records`, async () => {
      for (const t of TABLES) {
        const r = await c[role]!.from(t).select('id').eq('workspace_id', F);
        expect(r.error, t).toBeNull(); expect(r.data, t).toEqual([]);
      }
    });
  }

  it('signed-out visitors cannot read any review records', async () => {
    const anon = mk();
    for (const t of TABLES) {
      const r = await anon.from(t).select('id').eq('workspace_id', W);
      expect(r.error !== null || (r.data ?? []).length === 0, t).toBe(true);
    }
  });
});
