import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useWorkspace } from '@/components/app-shell';
import { AccessRequired, ContentList } from '@/components/content/content-ui';
import { canViewWorkspaceContent, contentTypes } from '@/lib/content';
import { workspaceContentOptions } from '@/lib/content-queries';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/content/all')({ head: () => meta('All content', 'Submitted content across this workspace.'), component: AllContent });

function AllContent() {
  const ws = useWorkspace(); const [type, setType] = useState('');
  const q = useQuery({ ...workspaceContentOptions(ws.id), enabled: !!ws.id && canViewWorkspaceContent(ws.role) });
  if (!canViewWorkspaceContent(ws.role)) return <AccessRequired message="Only managers can view all submitted content in this workspace." />;
  const rows = (q.data ?? []).filter(r => !type || r.type === type);
  return <>
    <p className="mb-2 text-xs font-semibold uppercase text-primary">{ws.name}</p><h1 className="text-3xl font-semibold">All content</h1><p className="mt-2 text-muted-foreground">Submitted content in this workspace. Drafts stay private to their creators.</p>
    <div className="mt-6"><label htmlFor="type-filter" className="mr-2 text-sm">Type</label><select id="type-filter" className="h-9 rounded-md border bg-card px-3 text-sm capitalize" value={type} onChange={e => setType(e.target.value)}><option value="">All</option>{contentTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
    {q.isPending ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : q.error ? <p role="alert" className="mt-6 text-sm text-destructive">{q.error.message}</p> : <ContentList rows={rows} empty="No submitted content yet." />}
  </>;
}
