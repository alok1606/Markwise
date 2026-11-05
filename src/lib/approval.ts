// Phase 6 pure rules: lifecycle, finding resolution, routing and text rewriting.
// The database functions enforce the same rules; these mirror them for the UI and for unit tests.
// Offsets are UTF-16 code units, zero-based, end-exclusive (same as Phase 4/5 findings).

export type ContentStatus = 'draft' | 'submitted' | 'checked' | 'pending_manager' | 'pending_reviewer' | 'changes_requested' | 'approved' | 'rejected' | 'in_review';
export type Decision = 'approved' | 'changes_requested' | 'rejected';
export type FindingAction = 'accepted' | 'edited' | 'dismissed';
export type AiState = 'completed' | 'failed' | 'pending';
export type Actor = 'creator' | 'manager' | 'reviewer' | 'system';

/** Every legal status transition. Anything not listed is refused. */
export const transitions: { from: ContentStatus; to: ContentStatus; by: Actor; via: string }[] = [
  { from: 'draft', to: 'submitted', by: 'creator', via: 'submit' },
  { from: 'submitted', to: 'checked', by: 'system', via: 'deterministic review completed' },
  { from: 'checked', to: 'submitted', by: 'creator', via: 'accept or edit a suggestion (new version)' },
  { from: 'checked', to: 'checked', by: 'creator', via: 'dismiss a finding' },
  { from: 'checked', to: 'pending_manager', by: 'creator', via: 'send for approval (manager route)' },
  { from: 'checked', to: 'pending_reviewer', by: 'creator', via: 'send for approval (reviewer route)' },
  { from: 'pending_manager', to: 'approved', by: 'manager', via: 'approve' },
  { from: 'pending_manager', to: 'changes_requested', by: 'manager', via: 'request changes' },
  { from: 'pending_manager', to: 'rejected', by: 'manager', via: 'reject' },
  { from: 'pending_reviewer', to: 'approved', by: 'reviewer', via: 'approve' },
  { from: 'pending_reviewer', to: 'changes_requested', by: 'reviewer', via: 'request changes' },
  { from: 'pending_reviewer', to: 'rejected', by: 'reviewer', via: 'reject' },
  { from: 'changes_requested', to: 'changes_requested', by: 'creator', via: 'revise (new version)' },
  { from: 'changes_requested', to: 'submitted', by: 'creator', via: 'resubmit' },
];
export const canTransition = (from: ContentStatus, to: ContentStatus, by: Actor) => transitions.some(t => t.from === from && t.to === to && t.by === by);
export const isFinal = (s: ContentStatus) => s === 'approved' || s === 'rejected';
export const isEditable = (s: ContentStatus) => s === 'draft' || s === 'changes_requested';

export const statusLabels: Record<ContentStatus, string> = {
  draft: 'Draft', submitted: 'Checking', checked: 'Checked', pending_manager: 'Awaiting manager', pending_reviewer: 'Awaiting reviewer',
  changes_requested: 'Changes requested', approved: 'Approved', rejected: 'Rejected', in_review: 'In review',
};

export type RoutingFinding = { id: string; category: string; severity: string; outcome: string; span_start: number | null };

/** Unresolved = no action recorded. Only unresolved high/critical findings (excluding supported claims) block approval. */
export function blockingFindings<F extends RoutingFinding>(findings: F[], resolvedIds: Set<string>) {
  return findings.filter(f => (f.severity === 'high' || f.severity === 'critical') && f.outcome !== 'supported' && !resolvedIds.has(f.id));
}

/** Claim, legal or cannot_verify findings (dismissed or not) force a named reviewer; everything else goes to the manager. */
export function routeFor(findings: RoutingFinding[]): 'reviewer' | 'manager' {
  return findings.some(f => f.category === 'claim' || f.category === 'legal' || f.outcome === 'cannot_verify') ? 'reviewer' : 'manager';
}

export function submitBlockers(i: { status: ContentStatus; aiState: AiState; blocking: number; route: 'reviewer' | 'manager'; reviewerId: string | null }) {
  const out: string[] = [];
  if (i.status !== 'checked') out.push('Only checked content can be sent for approval.');
  if (i.aiState === 'pending') out.push('The AI review has not finished for this version.');
  if (i.blocking > 0) out.push(`Resolve ${i.blocking} high or critical finding${i.blocking === 1 ? '' : 's'} first.`);
  if (i.route === 'reviewer' && !i.reviewerId) out.push('Choose a named reviewer.');
  return out;
}

export function decisionError(route: 'manager' | 'reviewer', decision: Decision, comment: string) {
  if ((route === 'reviewer' || decision !== 'approved') && !comment.trim()) return 'A comment is required for this decision.';
  if (comment.length > 4000) return 'Comment is limited to 4,000 characters.';
  return null;
}

export function dismissalError(reason: string) {
  const r = reason.trim();
  return r.length < 3 || reason.length > 1000 ? 'Give a reason (3–1000 characters).' : null;
}

/** Replaces exactly the quoted span. Throws if the text at the offsets is not the quoted text. */
export function applyRewrite(body: string, f: { span_start: number | null; span_end: number | null; quoted_text: string }, replacement: string) {
  if (f.span_start === null || f.span_end === null) throw new Error('This finding has no text to rewrite');
  if (f.span_start < 0 || f.span_end > body.length || f.span_end <= f.span_start || body.slice(f.span_start, f.span_end) !== f.quoted_text) throw new Error('The quoted text no longer matches this version');
  if (replacement.length > 2000) throw new Error('Replacement is limited to 2,000 characters');
  return body.slice(0, f.span_start) + replacement + body.slice(f.span_end);
}

/** Word-level diff for showing additions and removals. */
export type DiffPart = { kind: 'same' | 'added' | 'removed'; text: string };
export function diffWords(a: string, b: string): DiffPart[] {
  const x = a.split(/(\s+)/).filter(Boolean), y = b.split(/(\s+)/).filter(Boolean);
  const n = x.length, m = y.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const at = (i: number, j: number) => dp[i]![j]!;
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = x[i] === y[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  const out: DiffPart[] = []; const push = (kind: DiffPart['kind'], text: string) => { const l = out[out.length - 1]; if (l?.kind === kind) l.text += text; else out.push({ kind, text }); };
  let i = 0, j = 0;
  while (i < n && j < m) { if (x[i] === y[j]) { push('same', x[i]!); i++; j++; } else if (at(i + 1, j) >= at(i, j + 1)) push('removed', x[i++]!); else push('added', y[j++]!); }
  while (i < n) push('removed', x[i++]!); while (j < m) push('added', y[j++]!);
  return out;
}

export type CommentNode<C extends { id: string; parent_id: string | null }> = C & { replies: CommentNode<C>[] };
export function threadComments<C extends { id: string; parent_id: string | null }>(rows: C[]): CommentNode<C>[] {
  const map = new Map<string, CommentNode<C>>(rows.map(r => [r.id, { ...r, replies: [] }]));
  const roots: CommentNode<C>[] = [];
  for (const r of rows) { const n = map.get(r.id)!; const p = r.parent_id ? map.get(r.parent_id) : undefined; (p ? p.replies : roots).push(n); }
  return roots;
}
