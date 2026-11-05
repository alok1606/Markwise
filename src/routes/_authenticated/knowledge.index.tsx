import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowRight, BookOpenCheck, FileText, Image, ListChecks, Palette, Type } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useWorkspace } from '@/components/app-shell';
import { knowledgeOptions } from '@/lib/queries';
import { isVerifiedFact, profileCompletion } from '@/lib/knowledge';
import { setDemoKnowledge } from '@/lib/knowledge.functions';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/knowledge/')({ head: () => meta('Knowledge base overview', 'Summary of your brand knowledge base.'), component: Overview });

function Overview() {
  const w = useWorkspace(); const { data } = useSuspenseQuery(knowledgeOptions(w.id)); const qc = useQueryClient();
  const demo = useServerFn(setDemoKnowledge); const [busy, setBusy] = useState(false);
  const completion = profileCompletion(data.profile);
  const verified = data.facts.filter(f => isVerifiedFact(f)).length;
  const pending = data.facts.filter(f => f.status === 'pending').length;
  const hasDemo = [data.rules, data.facts, data.glossary, data.palette, data.fonts].some(list => list.some(r => r.is_demo)) || !!data.profile?.is_demo;
  const stats = [
    { label: 'Active rules', value: data.rules.filter(r => r.active).length, sub: `${data.rules.length} total`, to: '/knowledge/rules' as const, icon: ListChecks },
    { label: 'Verified facts', value: verified, sub: pending ? `${pending} awaiting approval` : `${data.facts.length} total`, to: '/knowledge/facts' as const, icon: BookOpenCheck },
    { label: 'Glossary terms', value: data.glossary.length, sub: `${data.glossary.reduce((n, g) => n + g.avoided_terms.length, 0)} prohibited terms`, to: '/knowledge/glossary' as const, icon: Type },
    { label: 'Guideline documents', value: data.documents.length, sub: 'Stored privately', to: '/knowledge/guidelines' as const, icon: FileText },
    { label: 'Brand assets', value: data.assets.length, sub: 'Logos and images', to: '/knowledge/visual' as const, icon: Image },
    { label: 'Brand colours', value: data.palette.length, sub: `${data.fonts.length} fonts`, to: '/knowledge/visual' as const, icon: Palette },
  ];
  const recent = [
    ...data.rules.map(r => ({ id: r.id, label: `${r.code} · ${r.title}`, kind: 'Rule', at: r.updated_at, to: '/knowledge/rules' as const })),
    ...data.facts.map(f => ({ id: f.id, label: `${f.code} · ${f.title}`, kind: 'Fact', at: f.updated_at, to: '/knowledge/facts' as const })),
    ...data.glossary.map(g => ({ id: g.id, label: g.preferred_term, kind: 'Glossary', at: g.updated_at, to: '/knowledge/glossary' as const })),
    ...data.documents.map(d => ({ id: d.id, label: d.name, kind: 'Document', at: d.updated_at, to: '/knowledge/guidelines' as const })),
    ...data.assets.map(a => ({ id: a.id, label: a.name, kind: 'Asset', at: a.updated_at, to: '/knowledge/visual' as const })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

  async function toggleDemo(load: boolean) {
    setBusy(true);
    try { await demo({ data: { workspace_id: w.id, load } }); await qc.invalidateQueries({ queryKey: ['knowledge', w.id] }); toast.success(load ? 'Fictional demo data loaded' : 'Demo data removed'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to update demo data'); } finally { setBusy(false); }
  }

  return <>
    <div className="rounded-lg border bg-card p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold">Brand profile</h2><p className="mt-1 text-sm text-muted-foreground">{completion === 100 ? 'Complete' : `${completion}% complete`}</p></div><Button asChild variant="outline"><Link to="/knowledge/profile">{completion ? 'Edit profile' : 'Start profile'} <ArrowRight /></Link></Button></div><Progress value={completion} className="mt-4" aria-label="Brand profile completion" /></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stats.map(s => <Link key={s.label} to={s.to} className="rounded-lg border bg-card p-5 transition-colors hover:border-primary"><s.icon className="size-5 text-primary" /><p className="mt-4 text-3xl font-semibold">{s.value}</p><p className="mt-1 text-sm font-medium">{s.label}</p><p className="text-xs text-muted-foreground">{s.sub}</p></Link>)}</div>
    <h2 className="mt-10 text-lg font-semibold">Recently updated</h2>
    {recent.length ? <ul className="mt-4 divide-y rounded-lg border bg-card">{recent.map(r => <li key={r.id}><Link to={r.to} className="flex items-center justify-between gap-4 p-4 text-sm hover:bg-muted"><span className="truncate"><span className="mr-2 text-xs uppercase text-muted-foreground">{r.kind}</span>{r.label}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(r.at).toLocaleDateString()}</span></Link></li>)}</ul>
      : <p className="mt-4 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nothing here yet. Start with your brand profile, or load the fictional Nimbus Onboard demo below.</p>}
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6"><div><h2 className="font-semibold">Fictional demo data</h2><p className="mt-1 text-sm text-muted-foreground">Nimbus Onboard is an imaginary company. Demo records are labelled and removing them never touches your own entries.</p></div>
      <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => toggleDemo(true)}>Load demo data</Button>{hasDemo && <Button variant="outline" disabled={busy} onClick={() => toggleDemo(false)}>Remove demo data</Button>}</div></div>
  </>;
}
