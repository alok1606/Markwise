// @vitest-environment node
// Read-only RLS acceptance. Requires the same private four-role/workspace fixture as the Admin Reviews tests.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const fixturePath = process.env['MARKWISE_ROLE_FIXTURE'];
const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
const roles = ['creator', 'manager', 'reviewer', 'admin'] as const;
const tables = ['accuracy_evaluation_runs', 'accuracy_evaluation_results'] as const;
const client = () => createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!fixturePath || !url || !key)('Live accuracy-evaluation RLS', { timeout: 120_000 }, () => {
  const sessions: Record<string, SupabaseClient> = {};
  let workspace = ''; let foreignWorkspace = '';

  beforeAll(async () => {
    const fixture = JSON.parse(readFileSync(fixturePath!, 'utf8')) as { workspace: string; foreign: string; accounts: Record<string, { email: string; password: string }> };
    workspace = fixture.workspace; foreignWorkspace = fixture.foreign;
    for (const role of roles) {
      const c = client(); const signedIn = await c.auth.signInWithPassword(fixture.accounts[role]!);
      if (signedIn.error) throw new Error(`Unable to sign in as ${role}`);
      sessions[role] = c;
    }
  });
  afterAll(async () => { await Promise.all(Object.values(sessions).map(c => c.auth.signOut())); });

  it('lets the workspace Admin read its own evaluation tables', async () => {
    for (const table of tables) {
      const response = await sessions['admin']!.from(table).select('id').eq('workspace_id', workspace);
      expect(response.error, table).toBeNull();
    }
  });

  for (const role of roles) {
    it(`${role} cannot read evaluation data from another workspace`, async () => {
      for (const table of tables) {
        const response = await sessions[role]!.from(table).select('id').eq('workspace_id', foreignWorkspace);
        expect(response.error, table).toBeNull(); expect(response.data, table).toEqual([]);
      }
    });
  }

  for (const role of ['creator', 'manager', 'reviewer'] as const) {
    it(`${role} cannot read Admin evaluation results or write either table`, async () => {
      for (const table of tables) {
        const read = await sessions[role]!.from(table).select('id').eq('workspace_id', workspace);
        expect(read.error, `${table} read`).toBeNull(); expect(read.data, `${table} read`).toEqual([]);
        const update = await sessions[role]!.from(table).update({ status: 'completed' }).eq('workspace_id', workspace).select('id');
        expect(update.error !== null || (update.data ?? []).length === 0, `${table} update`).toBe(true);
        const deletion = await sessions[role]!.from(table).delete().eq('workspace_id', workspace).select('id');
        expect(deletion.error !== null || (deletion.data ?? []).length === 0, `${table} delete`).toBe(true);
      }
    });
  }

  it('does not allow even an Admin client to insert evaluation records directly', async () => {
    const response = await sessions['admin']!.from('accuracy_evaluation_runs').insert({
      workspace_id: workspace, requested_by: '00000000-0000-4000-8000-000000000000',
      dataset_version: 'unauthorized-test', dataset_sha256: '0'.repeat(64), evaluator_version: 'test', model: 'test',
      prompt_version: 'test', as_of_date: '2026-01-01', total_cases: 0,
    });
    expect(response.error).not.toBeNull();
  });

  it('signed-out visitors cannot read evaluation runs', async () => {
    const anonymous = client();
    for (const table of tables) {
      const response = await anonymous.from(table).select('id').eq('workspace_id', workspace);
      expect(response.error !== null || (response.data ?? []).length === 0, table).toBe(true);
    }
  });
});
