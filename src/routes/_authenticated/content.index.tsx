import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/components/app-shell';
import { AccessRequired, ContentList } from '@/components/content/content-ui';
import { canCreateContent } from '@/lib/content';
import { myContentOptions } from '@/lib/content-queries';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/content/')({ head: () => meta('My content', 'Your drafts and submitted content in this workspace.'), component: MyContent });

function MyContent() {
  const ws = useWorkspace();
  const q = useQuery({ ...myContentOptions(ws.id), enabled: !!ws.id && canCreateContent(ws.role) });
  if (!canCreateContent(ws.role)) return <AccessRequired message="Only creators in this workspace have personal content." />;
  return <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase text-primary">{ws.name}</p><h1 className="text-3xl font-semibold">My content</h1><p className="mt-2 text-muted-foreground">Drafts you can edit, and content you have submitted.</p></div>
      <Button asChild><Link to="/content/new"><Plus />New content</Link></Button></div>
    {q.isPending ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : q.error ? <p role="alert" className="mt-6 text-sm text-destructive">{q.error.message}</p> :
      <ContentList rows={q.data} empty={<>No content yet. <Link to="/content/new" className="text-primary underline">Create your first draft</Link>.</>} />}
  </>;
}
