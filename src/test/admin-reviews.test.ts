import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { filterAdminReviews, readAdminReviews } from '@/lib/admin-reviews';
import { canCreateContent, canInspectReviews, canReviewAssigned, canViewWorkspaceContent } from '@/lib/content';

describe('Admin review boundaries', () => {
  it('only Admins inspect all workspace reviews', () => {
    expect(['creator', 'manager', 'reviewer', 'admin'].filter(r => canInspectReviews(r as never))).toEqual(['admin']);
  });
  it('Admin inspection does not grant creation or either approval role', () => {
    expect(canCreateContent('admin')).toBe(false); expect(canReviewAssigned('admin')).toBe(false); expect(canViewWorkspaceContent('admin')).toBe(false);
  });
  it('preserves Creator, Manager and Reviewer permissions', () => {
    expect(canCreateContent('creator')).toBe(true); expect(canViewWorkspaceContent('manager')).toBe(true); expect(canReviewAssigned('reviewer')).toBe(true);
    expect(canInspectReviews('creator')).toBe(false); expect(canInspectReviews('manager')).toBe(false); expect(canInspectReviews('reviewer')).toBe(false);
  });
  const rows = [{ title: 'Nimbus launch', owner_name: 'Alex', reviewer_name: 'Sam', status: 'approved' }, { title: 'Checklist', owner_name: 'Jo', reviewer_name: 'Not assigned', status: 'checked' }];
  it('searches content names case-insensitively', () => expect(filterAdminReviews(rows, ' NIMBUS ', 'all')).toEqual([rows[0]]));
  it('searches creators and assigned reviewers', () => { expect(filterAdminReviews(rows, 'Alex', 'all')).toEqual([rows[0]]); expect(filterAdminReviews(rows, 'Sam', 'all')).toEqual([rows[0]]); });
  it('combines status and search without including other statuses', () => { expect(filterAdminReviews(rows, '', 'checked')).toEqual([rows[1]]); expect(filterAdminReviews(rows, 'Nimbus', 'checked')).toEqual([]); });
  it('scopes every review/content/approval query to the selected workspace and resolves names only', async () => {
    const calls: { table: string; method: string; args: unknown[] }[] = [];
    const data: Record<string, unknown[]> = { reviews: [{ content_id: 'c1' }], contents: [{ id: 'c1', owner_id: 'creator', title: 'Nimbus', status: 'approved' }], approvals: [{ content_id: 'c1', reviewer_id: 'reviewer' }], profiles: [{ id: 'creator', full_name: 'Alex' }, { id: 'reviewer', full_name: 'Sam' }] };
    const client = { from: vi.fn((table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'is', 'order']) query[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return query; };
      query.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: data[table], error: null }).then(resolve);
      return query;
    }) } as unknown as SupabaseClient;
    const result = await readAdminReviews(client, 'workspace-A');
    expect(result[0]).toMatchObject({ owner_name: 'Alex', reviewer_name: 'Sam' });
    for (const table of ['reviews', 'contents', 'approvals']) expect(calls).toContainEqual({ table, method: 'eq', args: ['workspace_id', 'workspace-A'] });
    expect(calls).toContainEqual({ table: 'profiles', method: 'select', args: ['id,full_name'] });
    expect(calls.filter(c => c.method === 'eq' && c.args[0] === 'reviewer_id')).toEqual([]);
  });
  it('propagates RLS/query failures instead of presenting them as zero reviews', async () => {
    const query = { select: () => query, eq: () => Promise.resolve({ error: { message: 'denied' }, data: null }) };
    await expect(readAdminReviews({ from: () => query } as unknown as SupabaseClient, 'workspace-A')).rejects.toThrow('denied');
  });
});