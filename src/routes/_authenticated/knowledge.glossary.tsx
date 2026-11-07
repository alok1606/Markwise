import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Ban, Type } from 'lucide-react';
import { useWorkspace } from '@/components/app-shell';
import { EntityManager, type Field } from '@/components/knowledge/entity-manager';
import { knowledgeOptions } from '@/lib/queries';
import { glossarySchema } from '@/lib/knowledge';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/knowledge/glossary')({ head: () => meta('Brand glossary', 'Approved terms, prohibited terms and preferred alternatives.'), component: Glossary });
const fields: Field[] = [
  { name: 'preferred_term', label: 'Approved term', type: 'text', required: true },
  { name: 'avoided_terms', label: 'Prohibited terms', type: 'list', hint: 'Separate with commas; the approved term is their preferred alternative.' },
  { name: 'note', label: 'Definition', type: 'textarea' }, { name: 'usage_example', label: 'Usage example', type: 'textarea' },
  { name: 'spelling_note', label: 'Spelling preference', type: 'text' }, { name: 'case_sensitive', label: 'Case sensitive', type: 'checkbox' },
];
function Glossary() {
  const w = useWorkspace(); const { data } = useSuspenseQuery(knowledgeOptions(w.id));
  const alternatives = data.glossary.reduce((total, item) => total + item.avoided_terms.length, 0);
  return <>
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4"><div className="grid size-9 place-items-center rounded-lg bg-white text-blue-700 shadow-sm"><Type className="size-5" /></div><div><p className="text-2xl font-semibold leading-none text-blue-950">{data.glossary.length}</p><p className="mt-1 text-xs font-medium text-blue-800">Preferred terms</p></div></div>
      <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4"><div className="grid size-9 place-items-center rounded-lg bg-white text-rose-700 shadow-sm"><Ban className="size-5" /></div><div><p className="text-2xl font-semibold leading-none text-rose-950">{alternatives}</p><p className="mt-1 text-xs font-medium text-rose-800">Terms to avoid</p></div></div>
    </div>
    <EntityManager workspaceId={w.id} entity="glossary" title="Glossary" description="Preferred language and the terms it replaces across reviewed content." rows={data.glossary} fields={fields} schema={glossarySchema} layout="cards" cardIdCell={-1} cardTitleCell={0}
    columns={['Approved term', 'Prohibited terms', 'Definition']} emptyText="No glossary terms yet. Add an approved term, e.g. customers instead of clients."
    renderRow={g => [<div><p className="font-medium">{String(g.preferred_term)}</p><p className="text-xs text-muted-foreground">{g.case_sensitive ? 'Case sensitive' : 'Any case'}{g.is_demo ? ' · Fictional demo' : ''}</p></div>,
      <div className="flex flex-wrap gap-1.5">{(g.avoided_terms as string[]).length ? (g.avoided_terms as string[]).map(t => <span key={t} className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800 line-through decoration-rose-500">{t}</span>) : <span className="text-xs text-slate-400">No terms marked to avoid</span>}</div>,
      <div className="max-w-sm text-slate-600"><p>{String(g.note) || 'No definition added.'}</p>{g.usage_example ? <p className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs italic text-slate-600">“{String(g.usage_example)}”</p> : null}</div>]} />
  </>;
}
