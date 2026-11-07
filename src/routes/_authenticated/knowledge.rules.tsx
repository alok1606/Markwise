import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useWorkspace } from '@/components/app-shell';
import { EntityManager, type Field } from '@/components/knowledge/entity-manager';
import { knowledgeOptions } from '@/lib/queries';
import { ruleCategories, ruleKinds, ruleSchema, ruleTypes, severities } from '@/lib/knowledge';
import { setRuleActive } from '@/lib/knowledge.functions';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/knowledge/rules')({ head: () => meta('Brand rules', 'Brand rules and policies with severity and version history.'), component: Rules });
const fields: Field[] = [
  { name: 'code', label: 'Rule code', type: 'text', required: true, hint: 'Unique in this workspace, e.g. LEGAL-03' },
  { name: 'title', label: 'Title', type: 'text', required: true }, { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'category', label: 'Category', type: 'select', options: ruleCategories }, { name: 'severity', label: 'Severity', type: 'select', options: severities },
  { name: 'rule_type', label: 'Rule type', type: 'select', options: ruleTypes }, { name: 'kind', label: 'Check kind', type: 'select', options: ruleKinds },
  { name: 'pattern', label: 'Pattern (optional)', type: 'json', hint: 'For banned terms: {"terms":["guaranteed"]}' },
  { name: 'examples', label: 'Examples (optional)', type: 'textarea' }, { name: 'explanation', label: 'Explanation (optional)', type: 'textarea' },
  { name: 'active', label: 'Active', type: 'checkbox' },
];
const severityTone: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = { critical: 'destructive', high: 'default', medium: 'secondary', low: 'outline' };

function Rules() {
  const w = useWorkspace(); const { data } = useSuspenseQuery(knowledgeOptions(w.id)); const qc = useQueryClient(); const toggle = useServerFn(setRuleActive);
  async function setActive(id: string, active: boolean) {
    try { await toggle({ data: { workspace_id: w.id, id, active } }); await qc.invalidateQueries({ queryKey: ['knowledge', w.id] }); toast.success(active ? 'Rule activated' : 'Rule deactivated'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to update rule'); }
  }
  return <EntityManager workspaceId={w.id} entity="rules" title="Rules" description="Brand rules and policies. Every change keeps the previous version." rows={data.rules} fields={fields} schema={ruleSchema} historyEnabled
    columns={['Code', 'Rule', 'Severity', 'Type', 'Active']} layout="cards" emptyText="No rules yet. Add your first brand rule."
    renderRow={r => [<span className="font-mono text-xs">{String(r.code)}</span>, <div><p className="font-medium">{String(r.title)}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{String(r.category)} · v{String(r.version)}{r.is_demo ? ' · Fictional demo' : ''}</p></div>,
      <Badge variant={severityTone[String(r.severity)]} className="capitalize">{String(r.severity)}</Badge>, <span className="capitalize">{String(r.rule_type)}</span>,
      <Switch checked={Boolean(r.active)} aria-label={`${r.active ? 'Deactivate' : 'Activate'} ${String(r.code)}`} onCheckedChange={v => setActive(r.id, v)} />]} />;
}
