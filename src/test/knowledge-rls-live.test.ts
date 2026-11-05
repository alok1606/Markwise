// @vitest-environment node
// Live Phase 2 RLS and storage tests using real signed-in sessions for each role.
// Requires MARKWISE_KB_FIXTURE: a private JSON file (never committed) describing controlled test accounts:
// { workspaceA, workspaceB, accounts: [{ role: 'admin'|'manager'|'reviewer'|'creator'|'admin_b', email, password }] }
// admin/manager/reviewer/creator belong to workspaceA; admin_b administers workspaceB only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const fixturePath = process.env['MARKWISE_KB_FIXTURE'];
const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
const tables = ['brand_profiles', 'brand_documents', 'rules', 'facts', 'glossary', 'palette', 'brand_fonts', 'brand_assets', 'rule_history', 'fact_history'] as const;
type Seed = { ruleId: string; factId: string; glossaryId: string; docId: string; docPath: string; assetId: string; assetPath: string };

describe.skipIf(!fixturePath || !url || !key)('Live Phase 2 knowledge base RLS, storage and isolation', () => {
  const c: Record<string, SupabaseClient> = {}; let A = ''; let B = ''; const seed: Record<'A' | 'B', Seed> = {} as never;

  async function seedWorkspace(db: SupabaseClient, ws: string, label: string): Promise<Seed> {
    const ok = <T,>(r: { data: T; error: unknown }) => { if (r.error) throw new Error(`${label} seed: ${JSON.stringify(r.error)}`); return r.data; };
    const rule = ok(await db.from('rules').insert({ workspace_id: ws, code: `SEC-${label}`, category: 'legal', title: `Rule ${label}`, severity: 'high', rule_type: 'mandatory', kind: 'banned_term' }).select('id').single());
    const fact = ok(await db.from('facts').insert({ workspace_id: ws, code: `FACT-${label}`, title: `Fact ${label}`, statement: `Statement ${label}` }).select('id').single());
    const gl = ok(await db.from('glossary').insert({ workspace_id: ws, preferred_term: `term-${label}` }).select('id').single());
    const docPath = `${ws}/${randomUUID()}.txt`; const assetPath = `${ws}/${randomUUID()}.png`;
    ok(await db.storage.from('brand-documents').upload(docPath, new Blob([`secret ${label}`], { type: 'text/plain' }), { contentType: 'text/plain' }));
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), ch => ch.charCodeAt(0));
    ok(await db.storage.from('brand-assets').upload(assetPath, new Blob([png], { type: 'image/png' }), { contentType: 'image/png' }));
    const doc = ok(await db.from('brand_documents').insert({ workspace_id: ws, name: `doc-${label}.txt`, file_path: docPath, mime_type: 'text/plain', size_bytes: 10, uploaded_by: (await db.auth.getUser()).data.user!.id }).select('id').single());
    const asset = ok(await db.from('brand_assets').insert({ workspace_id: ws, name: `logo-${label}.png`, category: 'logo', file_path: assetPath, mime_type: 'image/png', size_bytes: png.length, uploaded_by: (await db.auth.getUser()).data.user!.id }).select('id').single());
    return { ruleId: rule.id, factId: fact.id, glossaryId: gl.id, docId: doc.id, docPath, assetId: asset.id, assetPath };
  }

  beforeAll(async () => {
    const f = JSON.parse(await readFile(fixturePath!, 'utf8')) as { workspaceA: string; workspaceB: string; accounts: { role: string; email: string; password: string }[] };
    A = f.workspaceA; B = f.workspaceB;
    for (const a of f.accounts) {
      const client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
      const s = await client.auth.signInWithPassword({ email: a.email, password: a.password }); if (s.error) throw new Error(`sign-in failed for ${a.role}`);
      c[a.role] = client;
    }
    seed.A = await seedWorkspace(c['admin']!, A, 'A'); seed.B = await seedWorkspace(c['admin_b']!, B, 'B');
  }, 60_000);

  afterAll(async () => {
    for (const [who, ws, s] of [['admin', A, seed.A], ['admin_b', B, seed.B]] as const) {
      const db = c[who]; if (!db || !s) continue;
      for (const t of ['rules', 'facts', 'glossary', 'brand_documents', 'brand_assets']) await db.from(t).delete().eq('workspace_id', ws);
      await db.storage.from('brand-documents').remove([s.docPath]); await db.storage.from('brand-assets').remove([s.assetPath]);
    }
  });

  it('admin reads, updates and downloads within own workspace', async () => {
    const db = c['admin']!;
    expect((await db.from('rules').select('id').eq('id', seed.A.ruleId)).data).toHaveLength(1);
    expect((await db.from('rules').update({ title: 'Rule A v2' }).eq('id', seed.A.ruleId).select('id')).data).toHaveLength(1);
    expect((await db.from('rule_history').select('id').eq('rule_id', seed.A.ruleId)).data!.length).toBeGreaterThan(0);
    expect((await db.storage.from('brand-documents').download(seed.A.docPath)).error).toBeNull();
    expect((await db.storage.from('brand-assets').createSignedUrl(seed.A.assetPath, 60)).error).toBeNull();
  });

  for (const role of ['manager', 'reviewer', 'creator']) {
    describe(`${role} in the same workspace`, () => {
      for (const t of tables) it(`cannot read ${t}`, async () => { expect((await c[role]!.from(t).select('*').eq('workspace_id', A)).data ?? []).toEqual([]); });
      it('cannot create records', async () => {
        expect((await c[role]!.from('rules').insert({ workspace_id: A, code: `X-${role}`.toUpperCase(), category: 'legal', title: 'x' })).error).not.toBeNull();
        expect((await c[role]!.from('facts').insert({ workspace_id: A, code: 'FACT-X', title: 'x', statement: 'x' })).error).not.toBeNull();
        expect((await c[role]!.from('brand_profiles').insert({ workspace_id: A, brand_name: 'x' })).error).not.toBeNull();
      });
      it('cannot update records by known ID', async () => {
        expect((await c[role]!.from('rules').update({ title: 'hacked' }).eq('id', seed.A.ruleId).select('id')).data ?? []).toEqual([]);
        expect((await c[role]!.from('facts').update({ status: 'approved' }).eq('id', seed.A.factId).select('id')).data ?? []).toEqual([]);
      });
      it('cannot delete records by known ID', async () => {
        expect((await c[role]!.from('glossary').delete().eq('id', seed.A.glossaryId).select('id')).data ?? []).toEqual([]);
        expect((await c['admin']!.from('glossary').select('id').eq('id', seed.A.glossaryId)).data).toHaveLength(1);
      });
      it('cannot download or sign private files', async () => {
        expect((await c[role]!.storage.from('brand-documents').download(seed.A.docPath)).error).not.toBeNull();
        expect((await c[role]!.storage.from('brand-assets').download(seed.A.assetPath)).error).not.toBeNull();
        expect((await c[role]!.storage.from('brand-documents').createSignedUrl(seed.A.docPath, 60)).error).not.toBeNull();
      });
      it('cannot upload or delete private files', async () => {
        expect((await c[role]!.storage.from('brand-assets').upload(`${A}/${randomUUID()}.png`, new Blob(['x'], { type: 'image/png' }))).error).not.toBeNull();
        await c[role]!.storage.from('brand-documents').remove([seed.A.docPath]);
        expect((await c['admin']!.storage.from('brand-documents').download(seed.A.docPath)).error).toBeNull();
      });
      it('cannot load or remove demo data', async () => {
        expect((await c[role]!.rpc('load_demo_knowledge', { _workspace_id: A })).error).not.toBeNull();
        expect((await c[role]!.rpc('remove_demo_knowledge', { _workspace_id: A })).error).not.toBeNull();
      });
    });
  }

  for (const [who, own, other] of [['admin', 'A', 'B'], ['admin_b', 'B', 'A']] as const) {
    describe(`${who} against the other workspace`, () => {
      const ws = () => (other === 'A' ? A : B); const s = () => seed[other];
      it('cannot read records even by known ID', async () => {
        for (const t of tables) expect((await c[who]!.from(t).select('*').eq('workspace_id', ws())).data ?? []).toEqual([]);
        expect((await c[who]!.from('rules').select('id').eq('id', s().ruleId)).data ?? []).toEqual([]);
      });
      it('cannot create, update or delete', async () => {
        expect((await c[who]!.from('rules').insert({ workspace_id: ws(), code: 'X-CROSS', category: 'legal', title: 'x' })).error).not.toBeNull();
        expect((await c[who]!.from('facts').update({ title: 'hacked' }).eq('id', s().factId).select('id')).data ?? []).toEqual([]);
        expect((await c[who]!.from('rules').delete().eq('id', s().ruleId).select('id')).data ?? []).toEqual([]);
      });
      it('cannot move own records into the other workspace', async () => {
        const r = await c[who]!.from('rules').update({ workspace_id: ws() }).eq('id', seed[own].ruleId).select('workspace_id');
        expect(r.error !== null || (r.data ?? []).every(x => x.workspace_id !== ws())).toBe(true);
      });
      it('cannot download, sign, upload or delete the other workspace files', async () => {
        expect((await c[who]!.storage.from('brand-documents').download(s().docPath)).error).not.toBeNull();
        expect((await c[who]!.storage.from('brand-assets').createSignedUrl(s().assetPath, 60)).error).not.toBeNull();
        expect((await c[who]!.storage.from('brand-documents').upload(`${ws()}/${randomUUID()}.txt`, new Blob(['x'], { type: 'text/plain' }))).error).not.toBeNull();
        await c[who]!.storage.from('brand-assets').remove([s().assetPath]);
        const owner = other === 'A' ? 'admin' : 'admin_b';
        expect((await c[owner]!.storage.from('brand-assets').download(s().assetPath)).error).toBeNull();
      });
      it('cannot run demo functions on the other workspace', async () => {
        expect((await c[who]!.rpc('load_demo_knowledge', { _workspace_id: ws() })).error).not.toBeNull();
      });
    });
  }
});
