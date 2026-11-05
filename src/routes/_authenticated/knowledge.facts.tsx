import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/components/app-shell';
import { EntityManager, type Field } from '@/components/knowledge/entity-manager';
import { knowledgeOptions } from '@/lib/queries';
import { effectiveFactStatus, factSchema, factStatuses } from '@/lib/knowledge';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/knowledge/facts')({ head: () => meta('Approved facts', 'Verified brand facts and claims with sources and approval tracking.'), component: Facts });
const fields: Field[] = [
  { name: 'code', label: 'Fact ID', type: 'text', required: true, hint: 'Unique in this workspace, e.g. FACT-014' },
  { name: 'title', label: 'Title', type: 'text', required: true }, { name: 'statement', label: 'Statement', type: 'textarea', required: true },
  { name: 'source_note', label: 'Source', type: 'text', hint: 'Required before approval' }, { name: 'evidence', label: 'Supporting evidence', type: 'textarea' },
  { name: 'status', label: 'Status', type: 'select', options: factStatuses, hint: 'Approval is recorded under your name. Editing an approved statement, source or evidence returns it to pending.' },
  { name: 'valid_from', label: 'Valid from (optional)', type: 'date' }, { name: 'valid_until', label: 'Valid until (optional)', type: 'date' },
  { name: 'active', label: 'Active', type: 'checkbox' },
];
const tone: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = { approved: 'default', pending: 'secondary', rejected: 'destructive', expired: 'outline' };

function Facts() {
  const w = useWorkspace(); const { data } = useSuspenseQuery(knowledgeOptions(w.id));
  return <EntityManager workspaceId={w.id} entity="facts" title="Approved facts" description="Only approved, active and in-date facts count as verified." rows={data.facts} fields={fields} schema={factSchema} historyEnabled
    columns={['Fact ID', 'Statement', 'Status', 'Approval']} emptyText="No facts yet. Add a fact and approve it once its source is checked."
    renderRow={f => { const status = effectiveFactStatus({ status: String(f.status), valid_from: f.valid_from as string | null, valid_until: f.valid_until as string | null }); const verified = status === 'approved' && f.active; return [
      <span className="font-mono text-xs">{String(f.code)}</span>,
      <div className="max-w-md"><p className="font-medium">{String(f.title)}</p><p className="mt-1 text-muted-foreground">{String(f.statement)}</p><p className="mt-1 text-xs text-muted-foreground">{f.source_note ? `Source: ${String(f.source_note)}` : 'No source'} · v{String(f.version)}{f.valid_until ? ` · valid until ${String(f.valid_until)}` : ''}</p></div>,
      <div className="space-y-1"><Badge variant={tone[status]} className="capitalize">{status}</Badge>{!f.active && <p className="text-xs text-muted-foreground">Inactive</p>}<p className="text-xs text-muted-foreground">{verified ? 'Verified' : 'Not verified'}</p></div>,
      <span className="text-xs text-muted-foreground">{f.approved_at ? `Approved by ${String(f.approver_name)} on ${new Date(String(f.approved_at)).toLocaleDateString()}` : 'Not approved'}</span>]; }} />;
}
