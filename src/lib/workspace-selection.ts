import type { Role } from './access';

export type MembershipRow = { workspace_id: string; role: Role; created_at: string; workspaces: { id: string; name: string; created_by: string } | null };
export const workspaceStorageKey = (userId: string) => `markwise:active-workspace:${userId}`;

/** Deterministic order: invited workspaces first (newest assignment first), then personal ones, tie-broken by id. */
export function orderMemberships<T extends MembershipRow>(rows: T[], userId: string): T[] {
  return [...rows].sort((a, b) => {
    const ai = a.workspaces?.created_by !== userId ? 0 : 1, bi = b.workspaces?.created_by !== userId ? 0 : 1;
    if (ai !== bi) return ai - bi;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
    return a.workspace_id < b.workspace_id ? -1 : 1;
  });
}

/** Picks the active workspace id. A stored id is honoured only if the user is still a member; never grants anything. */
export function chooseWorkspace(rows: MembershipRow[], userId: string, stored: string | null): string {
  if (stored && rows.some(r => r.workspace_id === stored)) return stored;
  return orderMemberships(rows, userId)[0]?.workspace_id ?? '';
}

export const roleLabel = (role: Role) => role.charAt(0).toUpperCase() + role.slice(1);
