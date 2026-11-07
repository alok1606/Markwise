import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/components/app-shell';
import { AccessRequired, StatusBadge, TypeIcon } from '@/components/content/content-ui';
import { canInspectReviews, canReviewAssigned, contentStatuses, statusLabel, type ContentStatus } from '@/lib/content';
import { filterAdminReviews } from '@/lib/admin-reviews';
import { reviewQueueOptions } from '@/lib/content-queries';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/review')({ head: () => meta('Reviews', 'Workspace review evidence and assigned content approval history.'), component: ReviewQueue });

const label: Record<string, string> = { open: 'Awaiting your decision', approved: 'You approved', changes_requested: 'You requested changes', rejected: 'You rejected' };

function ReviewQueue() {
  const ws = useWorkspace();
  const admin = canInspectReviews(ws.role);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('all');
  const q = useQuery({ ...reviewQueueOptions(ws.id), enabled: !!ws.id && (canReviewAssigned(ws.role) || admin) });
  if (!canReviewAssigned(ws.role) && !admin) return <AccessRequired message="Only reviewers and workspace administrators can access reviews." />;
  if (admin) {
    const rows = (q.data ?? []).filter((r): r is Extract<NonNullable<typeof q.data>[number], { owner_name: string }> => 'owner_name' in r);
    const visible = filterAdminReviews(rows, search, status);
    return <>
      <p className="mb-2 text-xs font-semibold uppercase text-primary">{ws.name}</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">Reviews</h1><Badge variant="outline">Read only</Badge></div>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor="review-search">Search reviews</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="review-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Content, creator or reviewer" className="pl-9" /></div></div>
        <div className="space-y-1.5"><Label htmlFor="review-status">Status</Label><select id="review-status" value={status} onChange={e => setStatus(e.target.value)} className="h-9 max-w-full rounded-md border bg-background px-3 text-sm"><option value="all">All statuses</option>{contentStatuses.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}</select></div>
      </div>
      {q.isPending ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : q.error ? <p role="alert" className="mt-6 text-sm text-destructive">{q.error.message}</p> : <>
        <p className="mt-5 text-sm text-muted-foreground">{visible.length} review{visible.length === 1 ? '' : 's'}</p>
        {!visible.length ? <p className="mt-3 border-y py-8 text-center text-sm text-muted-foreground">No accessible reviews match this selection.</p> : <ul className="mt-3 divide-y border-y">{visible.map(r => <li key={r.id}><Link to="/content/$id" params={{ id: r.id }} className="flex flex-wrap items-start gap-3 py-5 hover:bg-muted/50"><TypeIcon type={r.type} /><div className="min-w-0 flex-1"><p className="break-words font-medium">{r.title}</p><p className="mt-1 break-words text-xs text-muted-foreground">Creator: {r.owner_name} · Reviewer: {r.reviewer_name}</p><p className="mt-2 text-xs text-muted-foreground">v{r.version} · Submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'} · Updated {new Date(r.updated_at).toLocaleString()}</p></div><StatusBadge status={r.status as ContentStatus} /></Link></li>)}</ul>}
      </>}
    </>;
  }
  const rows = (q.data ?? []).filter((r): r is Extract<NonNullable<typeof q.data>[number], { approval_status: string }> => 'approval_status' in r); const open = rows.filter(r => r.approval_status === 'open'); const done = rows.filter(r => r.approval_status !== 'open');
  const list = (items: typeof rows, empty: string) => !items.length ? <p className="mt-3 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{empty}</p>
    : <ul className="mt-3 divide-y rounded-lg border bg-card">{items.map(r => <li key={r.id}><Link to="/content/$id" params={{ id: r.id }} className="flex flex-wrap items-center gap-4 p-4 hover:bg-muted">
      <TypeIcon type={r.type} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.title}</p><p className="mt-1 text-xs text-muted-foreground">v{r.version} · assigned {new Date(r.assigned_at).toLocaleString()}</p></div>
      <Badge variant="outline">{label[r.approval_status] ?? r.approval_status}</Badge><StatusBadge status={r.status as ContentStatus} /></Link></li>)}</ul>;
  return <>
    <p className="mb-2 text-xs font-semibold uppercase text-primary">{ws.name}</p><h1 className="text-3xl font-semibold">Review queue</h1>
    <p className="mt-2 text-muted-foreground">Only content assigned to you by name appears here.</p>
    {q.isPending ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : q.error ? <p role="alert" className="mt-6 text-sm text-destructive">{q.error.message}</p> : <>
      <h2 className="mt-8 text-lg font-semibold">Awaiting your decision ({open.length})</h2>{list(open, 'Nothing is waiting for you.')}
      <h2 className="mt-8 text-lg font-semibold">Decided</h2>{list(done, 'No decisions yet.')}</>}
  </>;
}
