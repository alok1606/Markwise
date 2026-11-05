import { createFileRoute } from '@tanstack/react-router';
import { useWorkspace } from '@/components/app-shell';
import { AccessRequired } from '@/components/content/content-ui';
import { ContentEditor } from '@/components/content/content-editor';
import { canCreateContent } from '@/lib/content';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/content/new')({ head: () => meta('New content', 'Create a text, image or PDF draft.'), component: NewContent });

function NewContent() {
  const ws = useWorkspace();
  if (!canCreateContent(ws.role)) return <AccessRequired message="Only creators in this workspace can create content." />;
  return <><p className="mb-2 text-xs font-semibold uppercase text-primary">{ws.name}</p><h1 className="text-3xl font-semibold">New content</h1><p className="mb-6 mt-2 text-muted-foreground">Save a draft first. You can edit it until you submit it.</p>
    <ContentEditor key={ws.id} workspaceId={ws.id} /></>;
}
