import { describe, expect, it } from 'vitest';
import { chooseWorkspace, orderMemberships, workspaceStorageKey, type MembershipRow } from '@/lib/workspace-selection';
import { roleNavigation, type Role } from '@/lib/access';

const OWNER = 'owner-admin';
const shared = { id: 'ws-aks', name: 'AKS Company', created_by: OWNER };
const personal = (u: string) => ({ id: `ws-${u}`, name: 'My workspace', created_by: u });
const rows = (u: string, role: Role): MembershipRow[] => [
  { workspace_id: `ws-${u}`, role: 'creator', created_at: '2026-11-01T00:00:00Z', workspaces: personal(u) },
  { workspace_id: 'ws-aks', role, created_at: '2026-11-02T00:00:00Z', workspaces: shared },
];

describe.each(['manager', 'reviewer', 'creator'] as Role[])('%s invited to a shared workspace', role => {
  const u = `user-${role}`;
  it('first login opens the invited workspace with the invited role, regardless of row order', () => {
    for (const list of [rows(u, role), rows(u, role).reverse()]) {
      const id = chooseWorkspace(list, u, null);
      expect(id).toBe('ws-aks');
      expect(list.find(r => r.workspace_id === id)!.role).toBe(role);
    }
  });
  it('switching to the personal workspace persists across refresh and shows creator access', () => {
    const id = chooseWorkspace(rows(u, role), u, 'ws-' + u);
    expect(id).toBe('ws-' + u);
    expect(rows(u, role).find(r => r.workspace_id === id)!.role).toBe('creator');
    expect(roleNavigation.creator).not.toContain('Users');
  });
  it('a stored workspace the user does not belong to is ignored and grants nothing', () => {
    expect(chooseWorkspace(rows(u, role), u, 'ws-foreign')).toBe('ws-aks');
  });
});

describe('Admin', () => {
  const adminRows: MembershipRow[] = [{ workspace_id: 'ws-aks', role: 'admin', created_at: '2026-10-01T00:00:00Z', workspaces: shared }];
  it('opens its own workspace with admin navigation', () => {
    const id = chooseWorkspace(adminRows, OWNER, null);
    expect(id).toBe('ws-aks');
    expect(roleNavigation.admin).toContain('Users');
  });
  it('ignores a foreign stored workspace', () => expect(chooseWorkspace(adminRows, OWNER, 'ws-foreign')).toBe('ws-aks'));
});

describe('ordering and storage', () => {
  it('orders deterministically and stores selection per account', () => {
    const a = orderMemberships(rows('x', 'manager'), 'x').map(r => r.workspace_id);
    const b = orderMemberships(rows('x', 'manager').reverse(), 'x').map(r => r.workspace_id);
    expect(a).toEqual(b);
    expect(workspaceStorageKey('a')).not.toBe(workspaceStorageKey('b'));
  });

});
