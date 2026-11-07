import type { SupabaseClient } from '@supabase/supabase-js';

/** RLS caller only; every content-linked read includes the selected workspace. */
export async function readAdminReviews(client: SupabaseClient, workspaceId: string) {
  const reviews = await client.from('reviews').select('content_id').eq('workspace_id', workspaceId);
  if (reviews.error) throw new Error(reviews.error.message);
  const ids = [...new Set((reviews.data ?? []).map(r => r.content_id as string))];
  if (!ids.length) return [];
  const [content, approvals] = await Promise.all([
    client.from('contents').select('id,title,type,channel,status,version,owner_id,submitted_at,updated_at').eq('workspace_id', workspaceId).in('id', ids).is('deleted_at', null).order('updated_at', { ascending: false }),
    client.from('approvals').select('content_id,reviewer_id,created_at').eq('workspace_id', workspaceId).in('content_id', ids).order('created_at', { ascending: false }),
  ]);
  if (content.error || approvals.error) throw new Error(content.error?.message ?? approvals.error?.message);
  const people = [...new Set([...(content.data ?? []).map(c => c.owner_id as string), ...(approvals.data ?? []).map(a => a.reviewer_id as string | null).filter((id): id is string => !!id)])];
  // Profile RLS already permits workspace Admins; project only names, never emails.
  const profiles = people.length ? await client.from('profiles').select('id,full_name').in('id', people) : { data: [], error: null };
  if (profiles.error) throw new Error(profiles.error.message);
  const names = new Map((profiles.data ?? []).map(p => [p.id, p.full_name]));
  return (content.data ?? []).map(c => {
    const latest = (approvals.data ?? []).find(a => a.content_id === c.id);
    return { ...c, owner_name: names.get(c.owner_id) || 'Workspace member', reviewer_name: latest?.reviewer_id ? names.get(latest.reviewer_id) || 'Workspace member' : 'Not assigned' };
  }) as { id: string; title: string; type: 'text' | 'image' | 'pdf'; channel: string; status: string; version: number; owner_id: string; submitted_at: string | null; updated_at: string; owner_name: string; reviewer_name: string }[];
}

export function filterAdminReviews<T extends { title: string; owner_name: string; reviewer_name: string; status: string }>(rows: T[], search: string, status: string) {
  const term = search.trim().toLocaleLowerCase();
  return rows.filter(row => (status === 'all' || row.status === status) && (!term || [row.title, row.owner_name, row.reviewer_name].some(value => value.toLocaleLowerCase().includes(term))));
}