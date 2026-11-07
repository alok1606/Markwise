import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { BadgeCheck, Clock3, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/components/app-shell';
import { EntityManager, type Field } from '@/components/knowledge/entity-manager';
import { knowledgeOptions } from '@/lib/queries';
import { effectiveFactStatus, factSchema, factStatuses, isVerifiedFact } from '@/lib/knowledge';
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
const tone: Record<string, string> = { approved: 'border-emerald-200 bg-emerald-50 text-emerald-800', pending: 'border-amber-200 bg-amber-50 text-amber-800', rejected: 'border-rose-200 bg-rose-50 text-rose-800', expired: 'border-slate-200 bg-slate-100 text-slate-600' };

function Facts() {
  const w = useWorkspace(); const { data } = useSuspenseQuery(knowledgeOptions(w.id));
  const verified = data.facts.filter(isVerifiedFact).length;
  const pending = data.facts.filter(f => f.status === 'pending').length;
  const remaining = data.facts.length - verified - pending;
  return <>
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4"><div className="grid size-9 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm"><BadgeCheck className="size-5" /></div><div><p className="text-2xl font-semibold leading-none text-emerald-950">{verified}</p><p className="mt-1 text-xs font-medium text-emerald-800">Verified facts</p></div></div>
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4"><div className="grid size-9 place-items-center rounded-lg bg-white text-amber-700 shadow-sm"><Clock3 className="size-5" /></div><div><p className="text-2xl font-semibold leading-none text-amber-950">{pending}</p><p className="mt-1 text-xs font-medium text-amber-800">Awaiting approval</p></div></div>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="grid size-9 place-items-center rounded-lg bg-white text-slate-600 shadow-sm"><ShieldAlert className="size-5" /></div><div><p className="text-2xl font-semibold leading-none text-slate-900">{remaining}</p><p className="mt-1 text-xs font-medium text-slate-600">Not currently verified</p></div></div>
    </div>
    <EntityManager workspaceId={w.id} entity="facts" title="Approved facts" description="Only approved, active and in-date facts count as verified. Changes to approved wording return the fact to pending review." rows={data.facts} fields={fields} schema={factSchema} historyEnabled layout="cards"
    columns={['Fact ID', 'Statement', 'Status', 'Approval']} emptyText="No facts yet. Add a fact and approve it once its source is checked."
    renderRow={f => { const status = effectiveFactStatus({ status: String(f.status), valid_from: f.valid_from as string | null, valid_until: f.valid_until as string | null }); const verified = status === 'approved' && f.active; return [
      <span className="font-mono text-xs">{String(f.code)}</span>,
      <div className="max-w-2xl"><p className="font-semibold text-slate-900">{String(f.title)}</p><p className="mt-1 text-sm leading-6 text-slate-700">{String(f.statement)}</p><p className="mt-2 text-xs leading-5 text-slate-500">{f.source_note ? `Source: ${String(f.source_note)}` : 'No source recorded'} <span className="text-slate-300">·</span> v{String(f.version)}{f.valid_until ? ` · valid until ${String(f.valid_until)}` : ''}</p></div>,
      <div className="space-y-1.5"><Badge variant="outline" className={`capitalize ${tone[status]}`}>{status}</Badge><p className={`text-xs font-medium ${verified ? 'text-emerald-700' : 'text-slate-500'}`}>{verified ? 'Verified for use' : f.active ? 'Not verified' : 'Inactive'}</p></div>,
      <span className="text-xs leading-5 text-slate-600">{f.approved_at ? `Approved by ${String(f.approver_name)} on ${new Date(String(f.approved_at)).toLocaleDateString()}` : 'Not approved'}</span>]; }} />
  </>;
}
