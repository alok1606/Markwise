import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Image, Palette, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  const logoCount = data.assets.filter(a => a.category === 'logo').length;
  const imageCount = data.assets.filter(a => a.category === 'image').length;
  return <div className="space-y-8">
    <header className="border-b border-slate-200 pb-5"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">Visual standards</p><h2 className="text-2xl font-semibold tracking-tight text-slate-900">Visual identity</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">Approved colours, typography, logos, and imagery for your brand.</p></header>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4"><div className="grid size-9 place-items-center rounded-lg bg-white text-blue-700 shadow-sm"><Palette className="size-5" /></div><div><p className="text-2xl font-semibold leading-none text-blue-950">{data.palette.length}</p><p className="mt-1 text-xs font-medium text-blue-800">Brand colours</p></div></div>
      <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50/70 p-4"><div className="grid size-9 place-items-center rounded-lg bg-white text-violet-700 shadow-sm"><Type className="size-5" /></div><div><p className="text-2xl font-semibold leading-none text-violet-950">{data.fonts.length}</p><p className="mt-1 text-xs font-medium text-violet-800">Typefaces</p></div></div>
      <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-4"><div className="grid size-9 place-items-center rounded-lg bg-white text-teal-700 shadow-sm"><Image className="size-5" /></div><div><p className="text-2xl font-semibold leading-none text-teal-950">{data.assets.length}</p><p className="mt-1 text-xs font-medium text-teal-800">Approved assets <span className="font-normal">· {logoCount} logos, {imageCount} images</span></p></div></div>
    </div>
    {data.palette.length > 0 && <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">Palette at a glance</p><p className="mt-0.5 text-xs text-slate-500">Actual approved workspace colours</p></div><Badge variant="outline" className="border-slate-200 bg-white text-slate-600">{data.palette.length} swatches</Badge></div><div className="flex flex-wrap gap-2">{data.palette.map(c => <div key={c.id} title={`${c.name} · ${c.hex}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-1.5 pr-3"><span className="size-7 rounded-md border border-black/10" style={{ backgroundColor: c.hex }} aria-hidden="true" /><span className="text-xs font-medium text-slate-700">{c.name}</span><span className="font-mono text-[10px] text-slate-400">{c.hex}</span></div>)}</div></section>}
    <EntityManager workspaceId={w.id} entity="palette" title="Brand colours" description="Approved colours in HEX format." rows={data.palette} fields={colourFields} schema={paletteSchema} layout="cards" cardIdCell={-1} cardTitleCell={0}
      columns={['Colour', 'HEX', 'Usage']} emptyText="No brand colours yet."
      renderRow={c => [<div className="flex items-center gap-3"><span className="size-10 rounded-lg border border-slate-200 shadow-inner" style={{ backgroundColor: String(c.hex) }} aria-hidden="true" /><span className="font-semibold text-slate-900">{String(c.name)}</span></div>, <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{String(c.hex)}</span>, <span className="text-sm leading-5 text-slate-600">{String(c.usage_note) || 'No usage guidance added.'}</span>]} />
    <EntityManager workspaceId={w.id} entity="brand_fonts" title="Typography" description="Font names and how to use them." rows={data.fonts} fields={fontFields} schema={fontSchema} layout="cards" cardIdCell={-1} cardTitleCell={0}
      columns={['Font', 'Used for', 'Guidelines']} emptyText="No fonts yet."
      renderRow={f => [<div><p className="text-lg font-semibold tracking-tight text-slate-900">{String(f.name)}</p><p className="mt-0.5 text-xs text-slate-500">Brand typeface</p></div>, <span className="text-sm font-medium text-slate-700">{String(f['usage'] ?? '') || 'No usage specified.'}</span>, <span className="text-sm leading-5 text-slate-600">{String(f['guidelines'] ?? '') || 'No typography guidance added.'}</span>]} />
    <FileManager workspaceId={w.id} kind="asset" rows={data.assets} title="Logos and images" description="Approved brand assets, organised by category." />
  </div>;
}
