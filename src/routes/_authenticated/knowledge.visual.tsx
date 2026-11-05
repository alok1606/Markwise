import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/components/app-shell';
import { EntityManager, type Field } from '@/components/knowledge/entity-manager';
import { FileManager } from '@/components/knowledge/file-manager';
import { knowledgeOptions } from '@/lib/queries';
import { fontSchema, paletteSchema } from '@/lib/knowledge';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/knowledge/visual')({ head: () => meta('Visual identity', 'Brand colours, typography, logos and approved images.'), component: Visual });
const colourFields: Field[] = [{ name: 'name', label: 'Colour name', type: 'text', required: true }, { name: 'hex', label: 'HEX value', type: 'color', required: true }, { name: 'usage_note', label: 'Usage', type: 'text' }];
const fontFields: Field[] = [{ name: 'name', label: 'Font name', type: 'text', required: true }, { name: 'usage', label: 'Used for', type: 'text' }, { name: 'guidelines', label: 'Typography guidelines', type: 'textarea' }];

function Visual() {
  const w = useWorkspace(); const { data } = useSuspenseQuery(knowledgeOptions(w.id));
  return <div className="space-y-14">
    <EntityManager workspaceId={w.id} entity="palette" title="Brand colours" description="Approved colours in HEX format." rows={data.palette} fields={colourFields} schema={paletteSchema}
      columns={['Colour', 'HEX', 'Usage']} emptyText="No brand colours yet."
      renderRow={c => [<div className="flex items-center gap-3"><span className="size-8 rounded border" style={{ backgroundColor: String(c.hex) }} aria-hidden /><span className="font-medium">{String(c.name)}</span></div>, <span className="font-mono text-xs">{String(c.hex)}</span>, <span className="text-muted-foreground">{String(c.usage_note) || '—'}</span>]} />
    <EntityManager workspaceId={w.id} entity="brand_fonts" title="Typography" description="Font names and how to use them." rows={data.fonts} fields={fontFields} schema={fontSchema}
      columns={['Font', 'Used for', 'Guidelines']} emptyText="No fonts yet."
      renderRow={f => [<span className="font-medium">{String(f.name)}</span>, <span>{String(f['usage'] ?? '') || '—'}</span>, <span className="text-muted-foreground">{String(f['guidelines'] ?? '') || '—'}</span>]} />
    <FileManager workspaceId={w.id} kind="asset" rows={data.assets} title="Logos and images" description="Approved brand assets, organised by category." />
  </div>;
}
