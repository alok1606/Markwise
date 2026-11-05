// @vitest-environment node
import { describe, expect, it, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
const fixturePath = process.env['MARKWISE_TEST_ACCOUNTS'];
const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
// Requires a controlled fixture: creator, manager and reviewer accounts that are members of the admin's workspace.
describe.skipIf(!fixturePath || !url || !key)('Live Phase 2 knowledge base authorization', () => {
  const clients: Record<string, SupabaseClient> = {}; let adminWorkspace = ''; let foreignWorkspace = '';
  beforeAll(async () => {
    const accounts = JSON.parse(await readFile(fixturePath!, 'utf8')) as { role: string; id: string; email: string; password: string }[];
    for (const a of accounts) {
      const c = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
      const s = await c.auth.signInWithPassword({ email: a.email, password: a.password }); if (s.error) throw new Error(s.error.message);
      clients[a.role] = c;
      const roles = await c.from('user_roles').select('workspace_id,role').eq('user_id', a.id);
      if (a.role === 'admin') adminWorkspace = roles.data?.find(r => r.role === 'admin')?.workspace_id ?? '';
      if (a.role === 'creator') foreignWorkspace = roles.data?.find(r => r.workspace_id !== adminWorkspace)?.workspace_id ?? '';
    }
  });
  for (const role of ['creator', 'manager', 'reviewer']) {
    it(`${role} cannot read knowledge records`, async () => { const r = await clients[role]!.from('rules').select('id').eq('workspace_id', adminWorkspace); expect(r.data ?? []).toEqual([]); });
    it(`${role} cannot create rules`, async () => { const r = await clients[role]!.from('rules').insert({ workspace_id: adminWorkspace, code: 'X-01', category: 'legal', title: 'x' }); expect(r.error).not.toBeNull(); });
    it(`${role} cannot load demo data`, async () => { const r = await clients[role]!.rpc('load_demo_knowledge', { _workspace_id: adminWorkspace }); expect(r.error?.message).toContain('Only workspace administrators'); });
  }
  it('admin cannot read another workspace knowledge base', async () => { const r = await clients['admin']!.from('facts').select('id').eq('workspace_id', foreignWorkspace); expect(r.data ?? []).toEqual([]); });
  it('admin cannot write into another workspace', async () => { const r = await clients['admin']!.from('facts').insert({ workspace_id: foreignWorkspace, code: 'FACT-999', title: 'x', statement: 'x' }); expect(r.error).not.toBeNull(); });
});
