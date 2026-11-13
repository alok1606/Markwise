import { describe, expect, it, vi } from 'vitest';
import { assertFactImpactAdmin } from '@/lib/fact-impact.functions';

describe('fact impact workspace authorization', () => {
  it('requires Admin in the exact selected workspace before reading scan data', async () => {
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => ({ data: args['_role'] === 'admin' && args['_workspace_id'] === 'workspace-a', error: null }));
    const context = { userId: 'admin-a', supabase: { rpc } };
    await expect(assertFactImpactAdmin(context, 'workspace-a')).resolves.toBeUndefined();
    await expect(assertFactImpactAdmin(context, 'workspace-b')).rejects.toThrow('Only an administrator of this workspace can view fact impact scans');
    expect(rpc).toHaveBeenLastCalledWith('has_role', { _user_id: 'admin-a', _role: 'admin', _workspace_id: 'workspace-b' });
  });
  it.each(['creator', 'manager', 'reviewer'])('rejects %s from Admin fact-history access', async role => {
    const context = { userId: `${role}-user`, supabase: { rpc: async () => ({ data: false, error: null }) } };
    await expect(assertFactImpactAdmin(context, 'workspace-a')).rejects.toThrow('Only an administrator');
  });
  it('fails closed when the workspace role lookup errors', async () => {
    const context = { userId: 'admin-a', supabase: { rpc: async () => ({ data: true, error: new Error('lookup failed') }) } };
    await expect(assertFactImpactAdmin(context, 'workspace-a')).rejects.toThrow('Only an administrator');
  });
});
