// @vitest-environment node
// Read-only post-migration acceptance against existing records; no writes or service key.
// MARKWISE_ADMIN_REVIEW_SESSION is a private minted session file.
// MARKWISE_ADMIN_REVIEW_WORKSPACE / _FOREIGN_WORKSPACE identify authorized and unauthorized workspaces.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readAdminReviews } from '@/lib/admin-reviews';

const file = process.env['MARKWISE_ADMIN_REVIEW_SESSION'];
const workspace = process.env['MARKWISE_ADMIN_REVIEW_WORKSPACE'];
const foreign = process.env['MARKWISE_ADMIN_REVIEW_FOREIGN_WORKSPACE'];
const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
describe.skipIf(!file || !workspace || !foreign || !url || !key)('Live Admin review reads after migration', () => {
  let client: SupabaseClient;
  beforeAll(async () => {
    if (!file || !url || !key) throw new Error('Private fixture missing');
    const minted = JSON.parse(readFileSync(file, 'utf8'));
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const session = await client.auth.setSession(minted.session);
    if (session.error) throw new Error('Unable to restore test session');
  });
  it('reads existing workspace reviews independent of assigned Reviewer', async () => {
    if (!workspace) throw new Error('Workspace missing');
    const rows = await readAdminReviews(client, workspace);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.owner_name).toBeTruthy();
  });
  for (const table of ['contents', 'reviews', 'content_versions', 'findings', 'approvals', 'finding_actions', 'comments']) {
    it(`cannot read foreign workspace ${table}`, async () => {
      const r = await client.from(table).select('id').eq('workspace_id', foreign);
      expect(r.error).toBeNull(); expect(r.data).toEqual([]);
    });
  }
});