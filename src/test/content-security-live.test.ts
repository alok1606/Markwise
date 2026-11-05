// @vitest-environment node
// Live Phase 3 content security tests with real signed-in sessions.
// Requires MARKWISE_CONTENT_FIXTURE: private JSON (never committed) { workspaceA, workspaceB, accounts: [{ role, email, password }] }
// Roles: admin, manager, reviewer, creator, creator2 in workspaceA; creator_b, admin_b in workspaceB.
import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const fixturePath = process.env['MARKWISE_CONTENT_FIXTURE'];
const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe.skipIf(!fixturePath || !url || !key)('Live Phase 3 content security', { timeout: 60_000 }, () => {
  const c: Record<string, SupabaseClient> = {}; let A = ''; let B = '';
  const create = async (who: string, ws: string, type: 'text' | 'image' | 'pdf', body = 'Hello') => {
    const r = await c[who]!.rpc('create_content', { _workspace_id: ws, _type: type, _title: `${who} ${type}`, _channel: 'Web', _audience: '', _goal: '', _body_text: type === 'text' ? body : '', _alt_text: type === 'image' ? '' : null, _text_color: null, _background_color: null });
    if (r.error) throw new Error(r.error.message); return r.data as string;
  };
  const save = (who: string, id: string, v: number, body = 'Edited') => c[who]!.rpc('save_content_draft', { _content_id: id, _expected_version: v, _title: 'Edited', _channel: 'Web', _audience: '', _goal: '', _body_text: body, _alt_text: null, _text_color: null, _background_color: null, _pdf_text_confirmed: false });
  const read = async (who: string, id: string) => (await c[who]!.from('contents').select('id').eq('id', id)).data ?? [];

  beforeAll(async () => {
    const f = JSON.parse(await readFile(fixturePath!, 'utf8')) as { workspaceA: string; workspaceB: string; accounts: { role: string; email: string; password: string }[] };
    A = f.workspaceA; B = f.workspaceB;
    for (const a of f.accounts) { const cl = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } }); const s = await cl.auth.signInWithPassword({ email: a.email, password: a.password }); if (s.error) throw new Error(`sign-in failed for ${a.role}`); c[a.role] = cl; }
  }, 60_000);

  it('creator creates a draft at version 1 with an immutable first version', async () => {
    const id = await create('creator', A, 'text');
    const row = (await c['creator']!.from('contents').select('version,status').eq('id', id).single()).data;
    expect(row).toEqual({ version: 1, status: 'draft' });
    const v = (await c['creator']!.from('content_versions').select('version_number').eq('content_id', id)).data;
    expect(v).toEqual([{ version_number: 1 }]);
  });

  it('versions are assigned by the database; stale versions are rejected', async () => {
    const id = await create('creator', A, 'text');
    expect((await save('creator', id, 1)).data).toBe(2);
    expect((await save('creator', id, 1)).error?.message).toMatch(/changed since/);
    expect((await save('creator', id, 99)).error?.message).toMatch(/changed since/);
  });

  it('concurrent saves of the same version: exactly one wins', async () => {
    const id = await create('creator', A, 'text');
    const results = await Promise.all([save('creator', id, 1, 'one'), save('creator', id, 1, 'two'), save('creator', id, 1, 'three')]);
    expect(results.filter(r => !r.error)).toHaveLength(1);
    const v = (await c['creator']!.from('content_versions').select('version_number').eq('content_id', id)).data ?? [];
    expect(v.map(x => x.version_number).sort()).toEqual([1, 2]);
  });

  it('save racing submit: content is never edited after submission', async () => {
    const id = await create('creator', A, 'text');
    await Promise.all([save('creator', id, 1), c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 1 })]);
    const row = (await c['creator']!.from('contents').select('status,version').eq('id', id).single()).data!;
    // Either the save won (still draft, v2) or submit won (submitted, v1); never submitted at v2 from a late edit.
    expect([['draft', 2], ['submitted', 1]]).toContainEqual([row.status, row.version]);
  });

  it('direct table writes are refused for everyone', async () => {
    const id = await create('creator', A, 'text');
    for (const who of ['creator', 'manager', 'reviewer', 'admin']) {
      expect((await c[who]!.from('contents').insert({ workspace_id: A, owner_id: randomUUID(), title: 'x', type: 'text' })).error).not.toBeNull();
      await c[who]!.from('contents').update({ title: 'hacked' }).eq('id', id);
      await c[who]!.from('contents').delete().eq('id', id);
    }
    expect((await c['creator']!.from('contents').select('title').eq('id', id).single()).data?.title).toBe('creator text');
  });

  it('content versions cannot be updated or deleted', async () => {
    const id = await create('creator', A, 'text');
    expect((await c['creator']!.from('content_versions').update({ title: 'x' }).eq('content_id', id)).error).not.toBeNull();
    expect((await c['creator']!.from('content_versions').delete().eq('content_id', id)).error).not.toBeNull();
    expect((await c['creator']!.from('content_versions').insert({ content_id: id, workspace_id: A, version_number: 9, title: 'x', channel: '', audience: '', goal: '', body_text: '', changed_by: randomUUID() })).error).not.toBeNull();
  });

  it('submitted content cannot be edited, deleted or resubmitted by its creator', async () => {
    const id = await create('creator', A, 'text');
    expect((await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 1 })).error).toBeNull();
    expect((await save('creator', id, 1)).error?.message).toMatch(/cannot be edited/);
    expect((await c['creator']!.rpc('delete_content_draft', { _content_id: id })).error?.message).toMatch(/cannot be deleted/);
    expect((await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 1 })).error?.message).toMatch(/already submitted/);
  });

  it('empty content cannot be submitted', async () => {
    const id = await create('creator', A, 'image');
    expect((await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 1 })).error?.message).toMatch(/Upload a file/);
  });

  it('only creators can create content', async () => {
    for (const who of ['manager', 'reviewer', 'admin']) expect((await c[who]!.rpc('create_content', { _workspace_id: A, _type: 'text', _title: 'x', _channel: '', _audience: '', _goal: '', _body_text: 'x', _alt_text: null, _text_color: null, _background_color: null })).error).not.toBeNull();
  });

  it('drafts are private to their creator', async () => {
    const id = await create('creator', A, 'text');
    for (const who of ['creator2', 'manager', 'reviewer', 'admin']) expect(await read(who, id)).toEqual([]);
    expect((await save('creator2', id, 1)).error).not.toBeNull();
    expect((await c['creator2']!.rpc('submit_content', { _content_id: id, _expected_version: 1 })).error).not.toBeNull();
    expect((await c['creator2']!.rpc('delete_content_draft', { _content_id: id })).error).not.toBeNull();
    expect((await c['creator2']!.from('content_versions').select('id').eq('content_id', id)).data ?? []).toEqual([]);
  });

  it('managers read submitted content and its history only; reviewers and admins do not', async () => {
    const id = await create('creator', A, 'text');
    await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 1 });
    expect(await read('manager', id)).toHaveLength(1);
    expect((await c['manager']!.from('content_versions').select('id').eq('content_id', id)).data).toHaveLength(1);
    expect(await read('reviewer', id)).toEqual([]); expect(await read('admin', id)).toEqual([]); expect(await read('creator2', id)).toEqual([]);
    expect((await c['manager']!.rpc('delete_content_draft', { _content_id: id })).error).not.toBeNull();
  });

  it('deleting a draft hides it and records the deletion', async () => {
    const id = await create('creator', A, 'text');
    expect((await c['creator']!.rpc('delete_content_draft', { _content_id: id })).error).toBeNull();
    expect(await read('creator', id)).toEqual([]);
  });

  it('creation, editing, submission and deletion are audited', async () => {
    const id = await create('creator', A, 'text'); await save('creator', id, 1);
    await c['creator']!.rpc('submit_content', { _content_id: id, _expected_version: 2 });
    const d = await create('creator', A, 'text'); await c['creator']!.rpc('delete_content_draft', { _content_id: d });
    const log = (await c['admin']!.from('audit_log').select('action,entity_id,user_id').in('entity_id', [id, d])).data ?? [];
    expect(log.filter(l => l.entity_id === id).map(l => l.action).sort()).toEqual(['content_created', 'content_edited', 'content_submitted']);
    expect(log.filter(l => l.entity_id === d).map(l => l.action).sort()).toEqual(['content_created', 'content_deleted']);
    expect((await c['creator']!.from('audit_log').select('id').in('entity_id', [id, d])).data ?? []).toEqual([]);
  });

  it('the privileged file-registration function cannot be called by users', async () => {
    const id = await create('creator', A, 'image');
    const r = await c['creator']!.rpc('set_content_file', { _actor: randomUUID(), _content_id: id, _expected_version: 1, _file_path: `${A}/${id}/${randomUUID()}.png`, _file_name: 'x.png', _file_mime: 'image/png', _file_size: 1 });
    expect(r.error).not.toBeNull();
  });

  it('file storage: owner uploads into own draft only; others cannot read or write', async () => {
    const id = await create('creator', A, 'image');
    const path = `${A}/${id}/${randomUUID()}.png`;
    expect((await c['creator']!.storage.from('content-files').upload(path, new Blob([png], { type: 'image/png' }), { contentType: 'image/png' })).error).toBeNull();
    expect((await c['creator']!.storage.from('content-files').download(path)).error).toBeNull();
    for (const who of ['creator2', 'manager', 'reviewer', 'admin', 'admin_b', 'creator_b']) {
      expect((await c[who]!.storage.from('content-files').download(path)).error).not.toBeNull();
      expect((await c[who]!.storage.from('content-files').upload(`${A}/${id}/${randomUUID()}.png`, new Blob([png], { type: 'image/png' }))).error).not.toBeNull();
    }
    // Files cannot be overwritten or deleted, so history keeps every file.
    await c['creator']!.storage.from('content-files').remove([path]);
    expect((await c['creator']!.storage.from('content-files').download(path)).error).toBeNull();
    expect((await c['creator']!.storage.from('content-files').upload(path, new Blob([png], { type: 'image/png' }), { upsert: true })).error).not.toBeNull();
    // A text item and a wrong folder cannot receive files.
    const textId = await create('creator', A, 'text');
    expect((await c['creator']!.storage.from('content-files').upload(`${A}/${textId}/${randomUUID()}.png`, new Blob([png]))).error).not.toBeNull();
    expect((await c['creator']!.storage.from('content-files').upload(`${B}/${id}/${randomUUID()}.png`, new Blob([png]))).error).not.toBeNull();
  }, 60_000);

  describe('cross-workspace isolation', () => {
    let bId = ''; let bPath = '';
    beforeAll(async () => {
      bId = await create('creator_b', B, 'image'); bPath = `${B}/${bId}/${randomUUID()}.png`;
      await c['creator_b']!.storage.from('content-files').upload(bPath, new Blob([png], { type: 'image/png' }), { contentType: 'image/png' });
      const t = await create('creator_b', B, 'text'); await c['creator_b']!.rpc('submit_content', { _content_id: t, _expected_version: 1 });
    }, 30_000);
    it('workspace A users cannot read workspace B content by ID or by workspace', async () => {
      for (const who of ['creator', 'manager', 'reviewer', 'admin']) {
        expect(await read(who, bId)).toEqual([]);
        expect((await c[who]!.from('contents').select('id').eq('workspace_id', B)).data ?? []).toEqual([]);
        expect((await c[who]!.from('content_versions').select('id').eq('workspace_id', B)).data ?? []).toEqual([]);
      }
    });
    it('workspace A users cannot update, submit, delete or create in workspace B', async () => {
      for (const who of ['creator', 'manager']) {
        expect((await save(who, bId, 1)).error).not.toBeNull();
        expect((await c[who]!.rpc('submit_content', { _content_id: bId, _expected_version: 1 })).error).not.toBeNull();
        expect((await c[who]!.rpc('delete_content_draft', { _content_id: bId })).error).not.toBeNull();
      }
      expect((await c['creator']!.rpc('create_content', { _workspace_id: B, _type: 'text', _title: 'x', _channel: '', _audience: '', _goal: '', _body_text: 'x', _alt_text: null, _text_color: null, _background_color: null })).error).not.toBeNull();
      expect(await read('creator_b', bId)).toHaveLength(1);
    });
    it('workspace A users cannot download or sign workspace B files', async () => {
      for (const who of ['creator', 'manager', 'admin']) {
        expect((await c[who]!.storage.from('content-files').download(bPath)).error).not.toBeNull();
        expect((await c[who]!.storage.from('content-files').createSignedUrl(bPath, 60)).error).not.toBeNull();
      }
    });
  });
});
