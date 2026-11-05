import { describe, expect, it } from 'vitest';
import { applyRewrite, blockingFindings, canTransition, decisionError, diffWords, dismissalError, isEditable, isFinal, routeFor, submitBlockers, threadComments } from '@/lib/approval';

const f = (o: Partial<{ id: string; category: string; severity: string; outcome: string; span_start: number | null }>) => ({ id: 'x', category: 'terminology', severity: 'medium', outcome: 'violation', span_start: 0, ...o });

describe('status transitions', () => {
  it('allows the approved lifecycle', () => {
    expect(canTransition('draft', 'submitted', 'creator')).toBe(true);
    expect(canTransition('submitted', 'checked', 'system')).toBe(true);
    expect(canTransition('checked', 'pending_reviewer', 'creator')).toBe(true);
    expect(canTransition('pending_manager', 'approved', 'manager')).toBe(true);
    expect(canTransition('pending_reviewer', 'rejected', 'reviewer')).toBe(true);
    expect(canTransition('changes_requested', 'submitted', 'creator')).toBe(true);
  });
  it('refuses skipped stages and wrong actors', () => {
    expect(canTransition('submitted', 'pending_manager', 'creator')).toBe(false);
    expect(canTransition('checked', 'approved', 'creator')).toBe(false);
    expect(canTransition('pending_reviewer', 'approved', 'manager')).toBe(false);
    expect(canTransition('pending_manager', 'approved', 'reviewer')).toBe(false);
    expect(canTransition('draft', 'approved', 'manager')).toBe(false);
  });
  it('approved and rejected are final; rejected cannot be resubmitted', () => {
    expect(isFinal('approved')).toBe(true); expect(isFinal('rejected')).toBe(true);
    expect(canTransition('rejected', 'submitted', 'creator')).toBe(false);
    expect(canTransition('approved', 'submitted', 'creator')).toBe(false);
  });
  it('only drafts and returned content are editable', () => {
    expect(isEditable('draft')).toBe(true); expect(isEditable('changes_requested')).toBe(true);
    for (const s of ['submitted', 'checked', 'pending_manager', 'pending_reviewer', 'approved', 'rejected'] as const) expect(isEditable(s)).toBe(false);
  });
});

describe('finding resolution gate', () => {
  it('only unresolved high/critical findings block', () => {
    const list = [f({ id: 'a', severity: 'high' }), f({ id: 'b', severity: 'critical' }), f({ id: 'c', severity: 'medium' }), f({ id: 'd', severity: 'low' })];
    expect(blockingFindings(list, new Set()).map(x => x.id)).toEqual(['a', 'b']);
    expect(blockingFindings(list, new Set(['a']))).toHaveLength(1);
    expect(blockingFindings(list, new Set(['a', 'b']))).toHaveLength(0);
  });
  it('supported claims never block', () => expect(blockingFindings([f({ severity: 'high', outcome: 'supported' })], new Set())).toHaveLength(0));
});

describe('routing', () => {
  it('claim, legal or cannot_verify findings need a named reviewer', () => {
    expect(routeFor([f({ category: 'claim' })])).toBe('reviewer');
    expect(routeFor([f({ category: 'legal' })])).toBe('reviewer');
    expect(routeFor([f({ category: 'tone', outcome: 'cannot_verify' })])).toBe('reviewer');
  });
  it('everything else goes to the manager', () => {
    expect(routeFor([])).toBe('manager');
    expect(routeFor([f({ category: 'terminology' }), f({ category: 'accessibility', severity: 'high' })])).toBe('manager');
  });
  it('submission blockers: AI pending blocks, AI failed does not', () => {
    const base = { status: 'checked' as const, blocking: 0, route: 'manager' as const, reviewerId: null };
    expect(submitBlockers({ ...base, aiState: 'pending' })).toHaveLength(1);
    expect(submitBlockers({ ...base, aiState: 'failed' })).toEqual([]);
    expect(submitBlockers({ ...base, aiState: 'completed', route: 'reviewer' })).toEqual(['Choose a named reviewer.']);
    expect(submitBlockers({ ...base, aiState: 'completed', status: 'submitted' })).toHaveLength(1);
  });
});

describe('comments and reasons', () => {
  it('reviewers always comment; managers comment to request changes or reject', () => {
    expect(decisionError('reviewer', 'approved', '')).not.toBeNull();
    expect(decisionError('manager', 'approved', '')).toBeNull();
    expect(decisionError('manager', 'rejected', ' ')).not.toBeNull();
    expect(decisionError('manager', 'changes_requested', 'Fix the claim')).toBeNull();
  });
  it('dismissal needs a 3–1000 character reason', () => {
    expect(dismissalError('')).not.toBeNull(); expect(dismissalError('ok')).not.toBeNull();
    expect(dismissalError('Approved by legal')).toBeNull(); expect(dismissalError('x'.repeat(1001))).not.toBeNull();
  });
  it('threads replies under their parent', () => {
    const t = threadComments([{ id: '1', parent_id: null }, { id: '2', parent_id: '1' }, { id: '3', parent_id: null }, { id: '4', parent_id: '2' }]);
    expect(t.map(x => x.id)).toEqual(['1', '3']); expect(t[0]!.replies[0]!.replies[0]!.id).toBe('4');
  });
});

describe('rewrites', () => {
  it('replaces exactly the quoted span (UTF-16 offsets, emoji safe)', () => {
    const body = '🎉 We guarantee results.';
    const start = body.indexOf('guarantee');
    expect(applyRewrite(body, { span_start: start, span_end: start + 9, quoted_text: 'guarantee' }, 'aim for')).toBe('🎉 We aim for results.');
  });
  it('refuses when the text at the offsets no longer matches', () => {
    expect(() => applyRewrite('Hello world', { span_start: 0, span_end: 5, quoted_text: 'world' }, 'x')).toThrow();
    expect(() => applyRewrite('Hello', { span_start: null, span_end: null, quoted_text: '' }, 'x')).toThrow();
  });
  it('word diff shows additions and removals', () => {
    expect(diffWords('we guarantee results', 'we aim for results')).toEqual([{ kind: 'same', text: 'we ' }, { kind: 'removed', text: 'guarantee' }, { kind: 'added', text: 'aim for' }, { kind: 'same', text: ' results' }]);
  });
});
