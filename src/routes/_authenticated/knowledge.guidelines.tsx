import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/components/app-shell';
import { FileManager } from '@/components/knowledge/file-manager';
import { knowledgeOptions } from '@/lib/queries';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/knowledge/guidelines')({ head: () => meta('Brand guidelines', 'Securely stored brand guideline documents.'), component: Guidelines });
function Guidelines() {
  const w = useWorkspace(); const { data } = useSuspenseQuery(knowledgeOptions(w.id));
  return <FileManager workspaceId={w.id} kind="document" rows={data.documents} title="Brand guidelines" description="Upload your brand guideline documents. Files are private to this workspace's administrators." />;
}
