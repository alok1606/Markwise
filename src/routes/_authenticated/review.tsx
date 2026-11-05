import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/components/app-shell';
import { AccessRequired, StatusBadge, TypeIcon } from '@/components/content/content-ui';
import { canReviewAssigned, type ContentStatus } from '@/lib/content';
import { reviewQueueOptions } from '@/lib/content-queries';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/review')({ head: () => meta('Review queue', 'Content assigned to you for review and approval.'), component: ReviewQueue });

const label: Record<string, string> = { open: 'Awaiting your decision', approved: 'You approved', changes_requested: 'You requested changes', rejected: 'You rejected' };

function ReviewQueue() {
  const ws = useWorkspace();
  const q = useQuery({ ...reviewQueueOptions(ws.id), enabled: !!ws.id && canReviewAssigned(ws.role) });
  if (!canReviewAssigned(ws.role)) return <AccessRequired message="Only reviewers have a review queue." />;
  const rows = q.data ?? []; const open = rows.filter(r => r.approval_status === 'open'); const done = rows.filter(r => r.approval_status !== 'open');
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
