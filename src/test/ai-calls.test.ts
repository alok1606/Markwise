import { describe, expect, it } from 'vitest';
import { AI_CALL_PAGE_SIZE, clampPage, cleanSearch, errorLabel, pageCount, shortRef, statusTone } from '@/lib/ai-calls';
import { roleNavigation } from '@/lib/access';

describe('AI call log helpers', () => {
  it('only Admins get the AI Calls menu item', () => {
    expect(roleNavigation.admin).toContain('AI Calls');
    for (const r of ['creator', 'manager', 'reviewer'] as const) expect(roleNavigation[r]).not.toContain('AI Calls');
  });
  it('paginates 20 per page', () => {
    expect(AI_CALL_PAGE_SIZE).toBe(20);
    expect(pageCount(0)).toBe(1); expect(pageCount(20)).toBe(1); expect(pageCount(21)).toBe(2);
    expect(clampPage(5, 21)).toBe(2); expect(clampPage(0, 21)).toBe(1);
  });
  it('strips filter-syntax characters from search', () => {
    expect(cleanSearch('gemini),status.eq.completed')).toBe('gemini  status.eq.completed');
    expect(cleanSearch('a'.repeat(200))).toHaveLength(80);
  });
  it('labels statuses and errors without inventing values', () => {
    expect(statusTone('succeeded')).toBe('good'); expect(statusTone('failed')).toBe('bad'); expect(statusTone('queued')).toBe('other');
    expect(errorLabel(null)).toBeNull(); expect(errorLabel('rate_limited')).toBe('Rate limited'); expect(errorLabel('new_kind')).toBe('new_kind');
  });
  it('shows content only as a short reference', () => { expect(shortRef('1234abcd-0000-0000-0000-000000000000')).toBe('#1234abcd'); });
});
