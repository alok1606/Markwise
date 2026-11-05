// Pure builder for the per-content Activity timeline. Inputs are rows the caller
// already read under RLS for this one content item, so no extra access is granted.

export type ActivityKind = 'version' | 'finding_action' | 'sent' | 'decision' | 'comment';
export type ActivityEvent = { key: string; kind: ActivityKind; at: string; actor: string; title: string; detail: string | null; tone: 'neutral' | 'good' | 'warn' | 'bad' };

type V = { id: string; version_number: number; change_summary: string; changed_by: string; created_at: string };
type A = { id: string; finding_id: string; action: string; reason: string | null; final_text: string | null; actor_id: string; created_at: string };
type P = { id: string; version_number: number; route: string; reviewer_id: string | null; assigned_by: string; status: string; decision_comment: string | null; decided_by: string | null; decided_at: string | null; created_at: string };
type C = { id: string; parent_id: string | null; author_id: string; message: string; created_at: string };

export type ActivityInput = { versions: V[]; actions: A[]; approvals: P[]; comments: C[]; names: Record<string, string>; ownerId: string; ownerName: string; userId: string };

/** Display name that never reveals an email address or hidden profile data. */
export function actorName(id: string | null, i: Pick<ActivityInput, 'names' | 'ownerId' | 'ownerName' | 'userId'>): string {
  if (!id) return 'Workspace member';
  if (id === i.userId) return 'You';
  const raw = id === i.ownerId ? (i.names[id] ?? i.ownerName) : i.names[id];
  return raw && !raw.includes('@') ? raw : 'Workspace member';
}

const ACTION: Record<string, [string, ActivityEvent['tone']]> = { accepted: ['Accepted a suggestion', 'good'], edited: ['Edited flagged text', 'neutral'], dismissed: ['Dismissed a finding', 'warn'] };
const DECISION: Record<string, [string, ActivityEvent['tone']]> = { approved: ['Approved', 'good'], changes_requested: ['Requested changes', 'warn'], rejected: ['Rejected', 'bad'] };

export function buildActivity(i: ActivityInput): ActivityEvent[] {
  const out = new Map<string, ActivityEvent>();
  const add = (e: ActivityEvent) => { if (!out.has(e.key)) out.set(e.key, e); };
  for (const v of i.versions) add({ key: `version:${v.id}`, kind: 'version', at: v.created_at, actor: actorName(v.changed_by, i), title: `Version ${v.version_number} saved`, detail: v.change_summary || null, tone: 'neutral' });
  for (const a of i.actions) { const [t, tone] = ACTION[a.action] ?? [`Finding ${a.action}`, 'neutral']; add({ key: `action:${a.id}`, kind: 'finding_action', at: a.created_at, actor: actorName(a.actor_id, i), title: t, detail: a.action === 'dismissed' ? (a.reason ? `Reason: ${a.reason}` : null) : (a.final_text ? `New text: “${a.final_text}”` : null), tone }); }
  for (const p of i.approvals) {
    const to = p.route === 'reviewer' ? `a Reviewer${p.reviewer_id ? ` (${actorName(p.reviewer_id, i)})` : ''}` : 'a Manager';
    add({ key: `sent:${p.id}`, kind: 'sent', at: p.created_at, actor: actorName(p.assigned_by, i), title: `Sent version ${p.version_number} for approval`, detail: `Routed to ${to}`, tone: 'neutral' });
    const d = DECISION[p.status];
    if (p.decided_at && d) { const [t, tone] = d; add({ key: `decision:${p.id}`, kind: 'decision', at: p.decided_at, actor: actorName(p.decided_by, i), title: `${t} version ${p.version_number}`, detail: p.decision_comment || null, tone }); }
  }
  for (const c of i.comments) add({ key: `comment:${c.id}`, kind: 'comment', at: c.created_at, actor: actorName(c.author_id, i), title: c.parent_id ? 'Replied to a comment' : 'Commented', detail: c.message, tone: 'neutral' });
  return [...out.values()].sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : a.key.localeCompare(b.key)));
}
