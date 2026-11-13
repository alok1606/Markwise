// Live RLS, persistence and workflow acceptance for version-scoped Office maps.
// Requires MARKWISE_CONTENT_FIXTURE with workspaceA/workspaceB and accounts:
// admin, manager, reviewer, creator, creator2, creator_b; also SUPABASE_URL,
// SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY. Uses the isolated test
// workspaces only; it does not run or apply migrations.
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const fixturePath = process.env['MARKWISE_CONTENT_FIXTURE'];
const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const makeClient = (apiKey: string) => createClient(url!, apiKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function validDocx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" PartName="/word/document.xml"/></Types>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Reviewable text</w:t></w:r></w:p></w:body></w:document>');
  return zip.generateAsync({ type: 'uint8array' });
}

describe.skipIf(!fixturePath || !url || !key || !serviceKey)('Live Office document-map security and persistence', { timeout: 120_000 }, () => {
  const clients: Record<string, SupabaseClient> = {};
  let admin: SupabaseClient; let workspaceA = ''; let workspaceB = ''; let creatorId = ''; let contentId = ''; let versionId = ''; let storagePath = '';
  const blocks = [{ kind: 'paragraph', location: 'Paragraph 1', text: 'Reviewable text', start: 0, end: 15 }];

  beforeAll(async () => {
    const fixture = JSON.parse(await readFile(fixturePath!, 'utf8')) as { workspaceA: string; workspaceB: string; accounts: { role: string; email: string; password: string }[] };
    workspaceA = fixture.workspaceA; workspaceB = fixture.workspaceB; admin = makeClient(serviceKey!);
    for (const account of fixture.accounts) {
      const client = makeClient(key!);
      const signIn = await client.auth.signInWithPassword({ email: account.email, password: account.password });
      if (signIn.error) throw new Error(`sign-in failed for ${account.role}`);
      clients[account.role] = client;
      if (account.role === 'creator') creatorId = signIn.data.user.id;
    }
    const created = await clients['creator']!.rpc('create_content', {
      _workspace_id: workspaceA, _type: 'docx', _title: 'Office map live test', _channel: 'Web', _audience: '', _goal: '',
      _body_text: '', _alt_text: null, _text_color: null, _background_color: null,
    });
    if (created.error) throw new Error(created.error.message);
    contentId = created.data as string;

    const bytes = await validDocx();
    storagePath = `${workspaceA}/${contentId}/${randomUUID()}.docx`;
    const uploaded = await clients['creator']!.storage.from('content-files').upload(storagePath, new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }), { contentType: mime, upsert: false });
    if (uploaded.error) throw new Error(uploaded.error.message);
    const fileRegistered = await admin.rpc('set_content_file', {
      _actor: creatorId, _content_id: contentId, _expected_version: 1, _file_path: storagePath, _file_name: 'review.docx', _file_mime: mime, _file_size: bytes.byteLength,
    });
    if (fileRegistered.error) throw new Error(fileRegistered.error.message);
    const unconfirmed = await clients['creator']!.rpc('save_content_draft', {
      _content_id: contentId, _expected_version: fileRegistered.data as number, _title: 'Office map live test', _channel: 'Web', _audience: '', _goal: '',
      _body_text: 'Reviewable text', _alt_text: null, _text_color: null, _background_color: null, _pdf_text_confirmed: false,
    });
    if (!unconfirmed.error) throw new Error('unconfirmed Office extraction was unexpectedly accepted');
    const saved = await clients['creator']!.rpc('save_content_draft', {
      _content_id: contentId, _expected_version: fileRegistered.data as number, _title: 'Office map live test', _channel: 'Web', _audience: '', _goal: '',
      _body_text: 'Reviewable text', _alt_text: null, _text_color: null, _background_color: null, _pdf_text_confirmed: true,
    });
    if (saved.error) throw new Error(saved.error.message);
    const version = await clients['creator']!.from('content_versions').select('id').eq('content_id', contentId).eq('version_number', saved.data as number).single();
    if (version.error) throw new Error(version.error.message);
    versionId = version.data.id;
    const registered = await admin.rpc('set_content_document_map', { _actor: creatorId, _content_id: contentId, _content_version_id: versionId, _blocks: blocks });
    if (registered.error) throw new Error(registered.error.message);
  }, 60_000);

  afterAll(async () => {
    if (storagePath && admin) await admin.storage.from('content-files').remove([storagePath]);
  });

  it('allows idempotent registration and rejects conflicting data for an immutable version', async () => {
    expect((await admin.rpc('set_content_document_map', { _actor: creatorId, _content_id: contentId, _content_version_id: versionId, _blocks: blocks })).error).toBeNull();
    const conflict = [{ ...blocks[0]!, text: 'Different text' }];
    expect((await admin.rpc('set_content_document_map', { _actor: creatorId, _content_id: contentId, _content_version_id: versionId, _blocks: conflict })).error).not.toBeNull();
    expect((await clients['creator']!.from('content_document_maps').update({ blocks: [] }).eq('content_version_id', versionId)).error).not.toBeNull();
  });

  it('persists locations across a fresh session and enforces workspace and role visibility', async () => {
    const initial = await clients['creator']!.from('content_document_maps').select('blocks').eq('content_version_id', versionId).single();
    expect(initial.data?.blocks).toEqual(blocks);
    const reopened = makeClient(key!);
    const fixture = JSON.parse(await readFile(fixturePath!, 'utf8')) as { accounts: { role: string; email: string; password: string }[] };
    const creator = fixture.accounts.find(account => account.role === 'creator')!;
    await reopened.auth.signInWithPassword({ email: creator.email, password: creator.password });
    expect((await reopened.from('content_document_maps').select('blocks').eq('content_version_id', versionId).single()).data?.blocks).toEqual(blocks);
    for (const role of ['creator2', 'manager', 'reviewer', 'admin', 'creator_b']) {
      const visible = await clients[role]!.from('content_document_maps').select('content_version_id').eq('content_version_id', versionId);
      expect(visible.data ?? []).toEqual([]);
    }
    const foreign = await clients['creator_b']!.from('content_document_maps').select('content_version_id').eq('workspace_id', workspaceB);
    expect(foreign.data ?? []).toEqual([]);
  });

  it('allows the current owner to submit only once', async () => {
    const edited = await clients['creator']!.rpc('save_content_draft', {
      _content_id: contentId, _expected_version: 3, _title: 'Office map live test', _channel: 'Web', _audience: '', _goal: '',
      _body_text: 'Revised reviewable text', _alt_text: null, _text_color: null, _background_color: null, _pdf_text_confirmed: true,
    });
    expect(edited.error).toBeNull();
    const nextVersion = await clients['creator']!.from('content_versions').select('id').eq('content_id', contentId).eq('version_number', 4).single();
    expect(nextVersion.error).toBeNull();
    if (nextVersion.error || !nextVersion.data) throw new Error('new Office content version was not saved');
    expect((await clients['creator']!.from('content_document_maps').select('content_version_id').eq('content_version_id', nextVersion.data.id)).data ?? []).toEqual([]);
    expect((await admin.rpc('set_content_document_map', { _actor: creatorId, _content_id: contentId, _content_version_id: versionId, _blocks: blocks })).error).not.toBeNull();
    const revisedBlocks = [{ kind: 'paragraph', location: 'Paragraph 1', text: 'Revised reviewable text', start: 0, end: 23 }];
    expect((await admin.rpc('set_content_document_map', { _actor: creatorId, _content_id: contentId, _content_version_id: nextVersion.data.id, _blocks: revisedBlocks })).error).toBeNull();
    expect((await clients['creator']!.from('content_document_maps').select('blocks').eq('content_version_id', versionId).single()).data?.blocks).toEqual(blocks);
    expect((await clients['creator']!.from('content_document_maps').select('blocks').eq('content_version_id', nextVersion.data.id).single()).data?.blocks).toEqual(revisedBlocks);
    expect((await clients['creator']!.rpc('submit_content', { _content_id: contentId, _expected_version: 4 })).error).toBeNull();
    expect((await clients['creator']!.rpc('submit_content', { _content_id: contentId, _expected_version: 4 })).error).not.toBeNull();
    expect(workspaceB).not.toBe(workspaceA);
  });
});
