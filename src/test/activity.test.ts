import { describe, expect, it } from 'vitest';
import { actorName, buildActivity, type ActivityInput } from '@/lib/activity';

const base: ActivityInput = { versions: [], actions: [], approvals: [], comments: [], names: {}, ownerId: 'owner', ownerName: 'Priya', userId: 'viewer' };

describe('content activity timeline', () => {
  it('is empty when nothing happened', () => { expect(buildActivity(base)).toEqual([]); });

  it('orders newest first and covers every event type', () => {
    const ev = buildActivity({ ...base,
      versions: [{ id: 'v1', version_number: 1, change_summary: 'Created', changed_by: 'owner', created_at: '2026-11-05T10:00:00Z' }],
      actions: [{ id: 'a1', finding_id: 'f', action: 'dismissed', reason: 'Approved wording', final_text: null, actor_id: 'owner', created_at: '2026-11-05T11:00:00Z' }],
      approvals: [{ id: 'p1', version_number: 1, route: 'reviewer', reviewer_id: 'rev', assigned_by: 'owner', status: 'rejected', decision_comment: 'No', decided_by: 'rev', decided_at: '2026-11-05T13:00:00Z', created_at: '2026-11-05T12:00:00Z' }],
      comments: [{ id: 'c1', parent_id: null, author_id: 'rev', message: 'See LEGAL-03', created_at: '2026-11-05T12:30:00Z' }] });
    expect(ev.map(e => e.kind)).toEqual(['decision', 'comment', 'sent', 'finding_action', 'version']);
    expect(ev[0]!.title).toBe('Rejected version 1');
    expect(ev[3]!.detail).toBe('Reason: Approved wording');
  });

  it('shows changes requested and skips undecided approvals', () => {
    const p = { id: 'p', version_number: 2, route: 'manager', reviewer_id: null, assigned_by: 'owner', decision_comment: null, decided_by: 'm', created_at: '2026-11-05T12:00:00Z' };
    expect(buildActivity({ ...base, approvals: [{ ...p, status: 'changes_requested', decided_at: '2026-11-05T12:05:00Z' }] })[0]!.title).toBe('Requested changes version 2');
    expect(buildActivity({ ...base, approvals: [{ ...p, status: 'open', decided_at: null }] }).map(e => e.kind)).toEqual(['sent']);
  });

  it('removes duplicate rows', () => {
    const c = { id: 'c1', parent_id: null, author_id: 'x', message: 'hi', created_at: '2026-11-05T12:00:00Z' };
    expect(buildActivity({ ...base, comments: [c, c] })).toHaveLength(1);
  });

  it('never shows email addresses or unknown people', () => {
    const i = { ...base, names: { owner: 'priya@example.com', other: 'Ravi' } };
    expect(actorName('owner', i)).toBe('Workspace member');
    expect(actorName('hidden', i)).toBe('Workspace member');
    expect(actorName('other', i)).toBe('Ravi');
    expect(actorName('viewer', i)).toBe('You');
  });
});
