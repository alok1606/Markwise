// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

// Explicit owner-authorized minted session; never commit session contents.
const path = process.env['MARKWISE_AUDIT_SESSION'];
describe.skipIf(!path)('Live owner profile validation', () => {
  it.each(['', '   ', 'x'.repeat(101)])('rejects an invalid direct profile-name update (%#)', async name => {
    if (!path) throw new Error('Authorized session fixture required');
    const fixture = JSON.parse(await readFile(path, 'utf8'));
    const config = await readFile('.env', 'utf8');
    const value = (key: string) => config.match(new RegExp(`^${key}=["']?([^"'\\n]+)`, 'm'))?.[1];
    const url = value('VITE_SUPABASE_URL'); const key = value('VITE_SUPABASE_PUBLISHABLE_KEY');
    if (!url || !key) throw new Error('Public client configuration missing');
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${fixture.session.access_token}` } } });
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