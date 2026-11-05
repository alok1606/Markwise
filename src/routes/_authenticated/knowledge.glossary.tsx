import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
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
  return <EntityManager workspaceId={w.id} entity="glossary" title="Glossary" description="Approved terms and the prohibited terms they replace." rows={data.glossary} fields={fields} schema={glossarySchema}
    columns={['Approved term', 'Prohibited terms', 'Definition']} emptyText="No glossary terms yet. Add an approved term, e.g. customers instead of clients."
    renderRow={g => [<div><p className="font-medium">{String(g.preferred_term)}</p><p className="text-xs text-muted-foreground">{g.case_sensitive ? 'Case sensitive' : 'Any case'}{g.is_demo ? ' · Fictional demo' : ''}</p></div>,
      <div className="flex flex-wrap gap-1">{(g.avoided_terms as string[]).length ? (g.avoided_terms as string[]).map(t => <span key={t} className="rounded bg-muted px-2 py-0.5 text-xs line-through decoration-destructive">{t}</span>) : <span className="text-xs text-muted-foreground">None</span>}</div>,
      <div className="max-w-sm text-muted-foreground"><p>{String(g.note) || '—'}</p>{g.usage_example ? <p className="mt-1 text-xs italic">“{String(g.usage_example)}”</p> : null}</div>]} />;
}
