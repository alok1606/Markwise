// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { assertStagingProjectTarget, assertStagingPublishableKey } from '@/integrations/supabase/staging-target';

// Explicit owner-authorized minted session; never commit session contents. This test
// must never read .env because local .env files can target the production project.
const path = process.env['MARKWISE_AUDIT_SESSION'];
const stagingMode = process.env['MARKWISE_STAGING_MODE'] === 'true' && process.env['VITE_MARKWISE_STAGING_MODE'] === 'true';
const url = process.env['SUPABASE_URL'];
const browserUrl = process.env['VITE_SUPABASE_URL'];
const serverKey = process.env['SUPABASE_PUBLISHABLE_KEY'];
const browserKey = process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
const expectedProjectRef = process.env['MARKWISE_EXPECTED_SUPABASE_PROJECT_REF'];
const browserExpectedProjectRef = process.env['VITE_MARKWISE_EXPECTED_SUPABASE_PROJECT_REF'];

describe.skipIf(!path || !stagingMode || !url || !browserUrl || !serverKey || !browserKey || !expectedProjectRef || !browserExpectedProjectRef)('Live owner profile validation (isolated staging only)', () => {
  it.each(['', '   ', 'x'.repeat(101)])('rejects an invalid direct profile-name update (%#)', async name => {
    if (!path || !url || !browserUrl || !serverKey || !browserKey || !expectedProjectRef || !browserExpectedProjectRef) {
      throw new Error('Authorized session fixture and isolated staging configuration required');
    }
    if (!stagingMode) throw new Error('Both Markwise staging mode flags must be enabled for this live test.');
    if (serverKey !== browserKey) throw new Error('Staging browser and server publishable keys must match.');
    assertStagingProjectTarget({
      enabled: true,
      expectedProjectRef,
      browserExpectedProjectRef,
      browserUrl,
      serverUrl: url,
    });
    assertStagingPublishableKey(browserKey);
    const fixture = JSON.parse(await readFile(path, 'utf8'));
    const client = createClient(browserUrl, browserKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${fixture.session.access_token}` } } });
    const id = fixture.session.user.id;
    const before = await client.from('profiles').select('full_name').eq('id', id).single();
    expect(before.error).toBeNull();
    try {
      const result = await client.from('profiles').update({ full_name: name }).eq('id', id);
      expect(result.error?.message).toContain('Name must contain 1 to 100 characters');
    } finally {
      if (before.data) await client.from('profiles').update({ full_name: before.data.full_name }).eq('id', id);
    }
  });
});
