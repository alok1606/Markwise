import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/components/app-shell';
import { AccessRequired } from '@/components/content/content-ui';
import { getFactImpactScan } from '@/lib/fact-impact.functions';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/fact-impact')({ head: () => meta('Fact impact scan', 'Trace changed brand facts to reviewed content in this workspace.'), component: FactImpactPage });
type ScanData = Awaited<ReturnType<typeof getFactImpactScan>>;
type Change = ScanData['changes'][number];
type Impact = ScanData['impacts'][number];

function FactImpactPage() {
  const workspace = useWorkspace(); const queryClient = useQueryClient(); const [search, setSearch] = useState('');
  const isAdmin = workspace.role === 'admin';
  const query = useQuery({ queryKey: ['fact-impact', workspace.id], queryFn: () => getFactImpactScan({ data: { workspace_id: workspace.id } }), enabled: !!workspace.id && isAdmin, staleTime: 0 });
  const changes = query.data?.changes ?? []; const impacts = query.data?.impacts ?? [];
  const visibleChanges = useMemo(() => changes.filter(change => `${change.code} ${change.title} ${change.old_value ?? ''} ${change.new_value ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [changes, search]);
  if (!isAdmin) return <AccessRequired message="Fact history and impact scans are restricted to administrators of the selected workspace." />;
  const confirmed = impacts.filter(impact => impact.confidence === 'confirmed').length;
  const possible = impacts.filter(impact => impact.confidence === 'possible').length;
  const impactsFor = (change: Change) => impacts.filter(impact => impact.change_id === change.id);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['fact-impact', workspace.id] });

  return <div className="space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue">Knowledge integrity</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-navy">Fact change impact</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Trace fact additions, edits and retirements to saved content versions and their review evidence. This scan is read-only and refreshes from the selected workspace.</p></div>
      <Button variant="outline" onClick={() => void refresh()} disabled={query.isFetching}><RefreshCw className={`mr-2 size-4 ${query.isFetching ? 'animate-spin' : ''}`} />Rescan workspace</Button>
    </header>

    <section className="grid gap-3 sm:grid-cols-3" aria-label="Scan summary">
      <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/[0.045] p-4"><div className="flex items-center gap-2 text-xs font-medium text-brand-blue"><Clock3 className="size-4" />Fact changes</div><p className="mt-3 text-3xl font-semibold text-brand-navy">{query.isPending ? '—' : changes.length}</p></div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"><div className="flex items-center gap-2 text-xs font-medium text-emerald-800"><ShieldCheck className="size-4" />Confirmed citation links</div><p className="mt-3 text-3xl font-semibold text-emerald-950">{query.isPending ? '—' : confirmed}</p></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><div className="flex items-center gap-2 text-xs font-medium text-amber-800"><AlertTriangle className="size-4" />Possible wording matches</div><p className="mt-3 text-3xl font-semibold text-amber-950">{query.isPending ? '—' : possible}</p></div>
    </section>

    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><h2 className="font-semibold text-brand-navy">Fact change history</h2><p className="mt-1 text-xs text-muted-foreground">Previous values come from immutable fact history; matching is limited to review-visible content.</p></div><label className="relative block w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Search fact changes" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      {query.isPending && <p className="p-8 text-sm text-muted-foreground">Scanning this workspace’s saved review history…</p>}
      {query.error && <div role="alert" className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p className="font-semibold">Impact scan could not be loaded</p><p className="mt-1">{query.error.message}</p><Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>Try again</Button></div>}
      {!query.isPending && !query.error && !visibleChanges.length && <div className="p-10 text-center"><CheckCircle2 className="mx-auto size-8 text-emerald-600" /><p className="mt-3 font-medium">{changes.length ? 'No matching fact changes' : 'No fact changes recorded'}</p><p className="mt-1 text-sm text-muted-foreground">{changes.length ? 'Try another fact code or phrase.' : 'New and historical facts will appear here as your team maintains the knowledge base.'}</p></div>}
      <div className="divide-y">
        {visibleChanges.map(change => {
          const related = impactsFor(change);
          return <article key={change.id} className="px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={change.kind === 'retired' ? 'border-rose-200 bg-rose-50 text-rose-800' : change.kind === 'created' ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-blue-200 bg-blue-50 text-blue-800'}>{change.kind}</Badge><span className="font-mono text-xs text-muted-foreground">{change.code}</span><h3 className="font-semibold text-brand-navy">{change.title}</h3><time className="ml-auto text-xs text-muted-foreground">{change.changed_at ? new Date(change.changed_at).toLocaleString() : 'Date unavailable'}</time></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><FactValue label="Previous value" value={change.old_value} empty="No previous value (new fact)" /><FactValue label="New value" value={change.new_value} empty="Fact was removed" /></div>
            <div className="mt-5 flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Affected reviewed content <span className="text-muted-foreground">({related.length})</span></h4>{related.length > 0 && <span className="text-xs text-muted-foreground">{related.filter(item => item.confidence === 'confirmed').length} confirmed · {related.filter(item => item.confidence === 'possible').length} possible</span>}</div>
            {!related.length ? <p className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No reviewed content versions matched this fact. Drafts and content without a saved review are excluded by existing Admin read permissions.</p> : <ul className="mt-3 space-y-2">{related.map(item => <ImpactItem key={`${item.change_id}:${item.content_version_id}`} item={item} />)}</ul>}
          </article>;
        })}
      </div>
    </section>

    <aside className="rounded-xl border border-brand-blue/15 bg-brand-blue/[0.035] p-4 text-sm leading-6 text-muted-foreground"><p className="font-medium text-brand-navy">How to interpret this scan</p><p className="mt-1"><strong>Confirmed</strong> means a saved finding cites this exact fact in this exact version. <strong>Possible</strong> means its prior or new wording occurs in the saved text, without a verified citation. Text matches are leads for human review, not proof that the content depends on the fact.</p><p className="mt-2">Opening a saved review does not change its status or content. To run checks against changed guidance, the existing content owner must create and submit a new version through the normal workflow.</p></aside>
    {query.data?.scanned_at && <p className="text-right text-xs text-muted-foreground">Scanned {new Date(query.data.scanned_at).toLocaleString()}</p>}
  </div>;
}

function FactValue({ label, value, empty }: { label: string; value: string | null; empty: string }) { return <div className="rounded-lg border bg-muted/20 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{value || <span className="italic text-muted-foreground">{empty}</span>}</p></div>; }
function ImpactItem({ item }: { item: Impact }) {
  const confirmed = item.confidence === 'confirmed';
  return <li className="flex flex-wrap items-start gap-3 rounded-lg border bg-background p-3">
    <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${confirmed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{confirmed ? <ShieldCheck className="size-3.5" /> : <AlertTriangle className="size-3.5" />}{confirmed ? 'Confirmed' : 'Possible'}</span>
    <div className="min-w-0 flex-1"><p className="font-medium text-brand-navy">{item.title} <span className="font-normal text-muted-foreground">· matched v{item.version_number}</span></p>{item.content && <p className="mt-1 text-xs capitalize text-muted-foreground">Current status: {item.content.status.replaceAll('_', ' ')} · latest version {item.content.version} · updated {new Date(item.content.updated_at).toLocaleDateString()}</p>}<p className="mt-1 text-xs leading-5 text-muted-foreground">{item.reason}</p><p className="mt-2 line-clamp-2 text-xs text-foreground">Matched: “{item.matched_text}”</p></div>
    <Link to="/content/$id" params={{ id: item.content_id }} className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline">Inspect review <ArrowUpRight className="size-4" /></Link>
  </li>;
}
