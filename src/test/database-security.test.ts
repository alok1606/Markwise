// @vitest-environment node
import { describe, expect, it, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
const fixturePath = process.env['MARKWISE_TEST_ACCOUNTS'];
const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
describe.skipIf(!fixturePath || !url || !key)('Live Phase 1 database authorization', () => {
  let creator: SupabaseClient;
  let admin: SupabaseClient;
  let creatorId: string;
  let adminId: string;
  let adminWorkspace: string;
  let creatorWorkspace: string;
  beforeAll(async () => {
    if (!fixturePath || !url || !key) throw new Error('Explicit controlled test fixtures required');
    const accounts = JSON.parse(await readFile(fixturePath, 'utf8')) as { role: string; id: string; email: string; password: string }[];
    for (const role of ['creator', 'admin']) {
      const account = accounts.find(a => a.role === role);
      if (!account) throw new Error('Test account missing');
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const signed = await client.auth.signInWithPassword({ email: account.email, password: account.password });
      if (signed.error) throw new Error(signed.error.message);
      const memberships = await client.from('user_roles').select('workspace_id').eq('user_id', account.id).order('created_at').limit(1);
      if (memberships.error || !memberships.data?.[0]) throw new Error('Membership missing');
      if (role === 'creator') { creator = client; creatorId = account.id; creatorWorkspace = memberships.data[0].workspace_id; }
      else { admin = client; adminId = account.id; adminWorkspace = memberships.data[0].workspace_id; }
    }
  });
  it('creator cannot read unrelated profiles', async () => {
    const result = await creator.from('profiles').select('id').neq('id', creatorId);
    expect(result.error).toBeNull(); expect(result.data).toEqual([]);
  });
  it('creator cannot directly change their own role', async () => {
    const result = await creator.from('user_roles').update({ role: 'admin' }).eq('user_id', creatorId);
    expect(result.error?.code).toBe('42501');
  });
  it('creator cannot self-promote through the authorized role function', async () => {
    const result = await creator.rpc('manage_workspace_member', { _workspace_id: creatorWorkspace, _user_id: creatorId, _role: 'admin' });
    expect(result.error?.message).toContain('Only workspace administrators');
  });
  it('last administrator cannot be demoted', async () => {
    const result = await admin.rpc('manage_workspace_member', { _workspace_id: adminWorkspace, _user_id: adminId, _role: 'creator' });
    expect(result.error?.message).toContain('last administrator');
  });
  it('admin cannot rename an unrelated workspace', async () => {
    const result = await admin.rpc('rename_workspace', { _workspace_id: creatorWorkspace, _name: 'Unauthorized' });
    expect(result.error?.message).toContain('Only workspace administrators');
  });
  it('creator cannot write audit records', async () => {
    const result = await creator.from('audit_log').insert({ workspace_id: creatorWorkspace, user_id: creatorId, action: 'forged', entity_type: 'profile' });
    expect(result.error?.code).toBe('42501');
  });
  it('admin cannot read an unrelated workspace', async () => {
    const result = await admin.from('workspaces').select('id').eq('id', creatorWorkspace);
    expect(result.error).toBeNull(); expect(result.data).toEqual([]);
  });
  it('creator cannot change profile email', async () => {
    const result = await creator.from('profiles').update({ email: 'forged@example.com' }).eq('id', creatorId);
    expect(result.error?.code).toBe('42501');
  });
});