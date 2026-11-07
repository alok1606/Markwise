import { AlertTriangle, CheckCircle2, CircleHelp, FileSearch2, HelpCircle, Info, LoaderCircle, Sparkles, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { overlapsWithDeterministic } from '@/lib/ai-review';
import { sortBySeverity } from '@/lib/approval';

type Finding = { id: string; review_id: string; source?: string | null; check_name: string; category: string; severity: string; confidence: number; span_start: number | null; span_end: number | null; quoted_text: string; explanation: string; cited_kind: string; cited_code: string; cited_passage: string; outcome: string; suggested_text?: string | null; evidence_kind?: string | null; bbox?: unknown };
type Review = { id: string; version_number: number; run_at: string; status: string; dropped_findings_count: number; downgraded_findings_count?: number | null; finding_count: number; limitations: unknown; model?: string | null; evidence_text?: string | null };

const checkLabel: Record<string, string> = { banned_term: 'Banned terms', terminology: 'Terminology', numeric_claim: 'Numeric claims', alt_text: 'Image accessibility', contrast: 'Contrast', palette: 'Palette' };
const verdict: Record<string, { label: string; icon: typeof AlertTriangle; variant: 'destructive' | 'secondary' | 'outline' | 'default'; tone: string }> = {
  violation: { label: 'Issue', icon: AlertTriangle, variant: 'destructive', tone: 'border-rose-200 bg-rose-50 text-rose-800' },
  contradicted: { label: 'Contradicted by an approved fact', icon: XCircle, variant: 'destructive', tone: 'border-rose-200 bg-rose-50 text-rose-800' },
  supported: { label: 'Supported by an approved fact', icon: CheckCircle2, variant: 'default', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  cannot_verify: { label: 'Needs checking', icon: HelpCircle, variant: 'secondary', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
};
const severityTone: Record<string, string> = {
  critical: 'border-rose-200 bg-rose-50 text-rose-800',
  high: 'border-orange-200 bg-orange-50 text-orange-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-sky-200 bg-sky-50 text-sky-800',
};
const box = (b: unknown) => Array.isArray(b) && b.length === 4 && b.every(n => typeof n === 'number') ? b as [number, number, number, number] : null;

export function AiReviewPanel({ review, findings, deterministic, imageUrl, canRun, running, onRun, lastError, renderActions }: { review: Review | null; findings: Finding[]; deterministic: Finding[]; imageUrl: string | null; canRun: boolean; running: boolean; onRun: () => void; lastError: string | null; renderActions?: (f: Finding) => React.ReactNode }) {
  if (!review) return <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="relative overflow-hidden bg-[#111d2d] px-5 py-5 text-white sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(90deg, transparent 49%, rgba(94,234,212,.6) 50%, transparent 51%), linear-gradient(rgba(94,234,212,.35) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <div className="relative flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><Sparkles className={`size-5 ${running ? 'motion-safe:animate-pulse' : ''}`} /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200">AI analysis</p><h3 className="mt-1 text-lg font-semibold tracking-tight">Suggestions for this version</h3></div></div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-200"><span className={`size-1.5 rounded-full ${running ? 'bg-teal-300 motion-safe:animate-pulse' : 'bg-slate-400'}`} />{running ? 'Review in progress' : 'Not reviewed'}</span></div>
      <p className="relative mt-3 max-w-2xl text-sm leading-6 text-slate-300">AI suggestions are saved separately from automatic checks. They never edit or approve content, and citations appear only when verified against approved workspace sources.</p>
    </div>
    <div className="p-4 sm:p-5">
      {lastError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-semibold text-rose-900">AI review didn’t complete</p><p className="mt-1 text-sm leading-5 text-rose-800">{lastError}</p></div> : <div className="flex flex-col gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-start gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-blue-700 shadow-sm"><FileSearch2 className="size-4" /></div><div><p className="text-sm font-semibold text-slate-900">No saved AI review yet</p><p className="mt-1 max-w-xl text-xs leading-5 text-slate-600">Run analysis on the submitted version to see suggestions, explanations, and verified evidence here.</p></div></div>{canRun && <Button className="shrink-0 rounded-lg bg-teal-700 text-white hover:bg-teal-800" onClick={onRun} disabled={running}>{running ? <><LoaderCircle className="motion-safe:animate-spin" />Reviewing…</> : <><Sparkles />Run AI review</>}</Button>}</div>}
      {canRun && lastError && <Button className="mt-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800" onClick={onRun} disabled={running}>{running ? <><LoaderCircle className="motion-safe:animate-spin" />Retrying…</> : <><Sparkles />Try again</>}</Button>}
      {!canRun && !lastError && <p className="mt-3 text-xs text-slate-500">AI review can be run by the content owner when this version is eligible.</p>}
    </div>
  </section>;
  const mine = findings.filter(f => f.review_id === review.id);
  const overlaps = overlapsWithDeterministic(mine, deterministic);
  const limitations = Array.isArray(review.limitations) ? review.limitations.filter((x): x is string => typeof x === 'string') : [];
  const boxes = mine.map(f => ({ f, b: box(f.bbox) })).filter(x => x.b);
  const confirmed = mine.filter(f => f.cited_kind !== 'none' && !!f.cited_code).length;
  const needsChecking = mine.filter(f => f.outcome === 'cannot_verify').length;
  const sharedFlags = mine.filter(f => overlaps.has(f.id)).length;
  return <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="relative overflow-hidden bg-[#111d2d] px-5 py-5 text-white sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(90deg, transparent 49%, rgba(94,234,212,.6) 50%, transparent 51%), linear-gradient(rgba(94,234,212,.35) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <div className="relative flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><Sparkles className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200">AI analysis · version {review.version_number}</p><h3 className="mt-1 text-lg font-semibold tracking-tight">Suggestions & evidence</h3></div></div><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-medium text-emerald-100"><span className="size-1.5 rounded-full bg-emerald-300" />Review saved</span></div>
      <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300"><time dateTime={review.run_at}>{new Date(review.run_at).toLocaleString()}</time>{review.model && <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-200">{review.model}</span>}<span>AI-generated · advisory only</span></div>
    </div>
    <div className="space-y-4 p-4 sm:p-5">
      <p className="max-w-4xl text-sm leading-6 text-slate-600">Suggestions only — nothing has been changed or approved. Citations appear only when confirmed against this workspace’s approved sources; unverified claims are marked “Needs checking”.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Suggestions" value={mine.length} tone="border-blue-200 bg-blue-50/70 text-blue-900" icon={<Sparkles className="size-4" />} />
        <Metric label="Verified sources" value={confirmed} tone="border-emerald-200 bg-emerald-50/70 text-emerald-900" icon={<CheckCircle2 className="size-4" />} />
        <Metric label="Needs checking" value={needsChecking} tone="border-amber-200 bg-amber-50/70 text-amber-950" icon={<CircleHelp className="size-4" />} />
        <Metric label="Also rule-flagged" value={sharedFlags} tone="border-violet-200 bg-violet-50/70 text-violet-900" icon={<FileSearch2 className="size-4" />} />
      </div>
      {limitations.map(l => <p key={l} className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-sm leading-5 text-blue-950"><Info className="mt-0.5 size-4 shrink-0 text-blue-700" />{l}</p>)}
      {(review.dropped_findings_count > 0 || (review.downgraded_findings_count ?? 0) > 0) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
        {review.dropped_findings_count} AI result(s) left out because the quoted text did not match exactly · {review.downgraded_findings_count ?? 0} changed to “Needs checking” because their citation could not be confirmed.</p>}
      {imageUrl && boxes.length > 0 && <div className="rounded-xl border border-slate-200 bg-slate-950 p-3"><p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-300"><FileSearch2 className="size-3.5 text-teal-300" />Image evidence · {boxes.length} highlighted {boxes.length === 1 ? 'area' : 'areas'}</p><div className="relative inline-block max-w-full"><img src={imageUrl} alt="" className="max-h-96 rounded-md" />
        {boxes.map(({ f, b }, i) => <span key={f.id} title={f.quoted_text} className="absolute rounded-sm border-2 border-rose-400" style={{ left: `${b![0] * 100}%`, top: `${b![1] * 100}%`, width: `${b![2] * 100}%`, height: `${b![3] * 100}%` }}><span className="absolute -top-5 left-0 rounded bg-rose-500 px-1 text-[10px] text-white">{i + 1}</span></span>)}</div></div>}
      {review.evidence_text && <details className="group rounded-xl border border-slate-200"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-700 marker:hidden"><span className="inline-flex items-center gap-2"><FileSearch2 className="size-4 text-blue-700" />Text the AI read in the image</span><span className="float-right text-xs text-slate-400 group-open:hidden">Show</span><span className="float-right hidden text-xs text-slate-400 group-open:inline">Hide</span></summary><p className="whitespace-pre-wrap border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{review.evidence_text}</p></details>}
      {!mine.length && <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm"><CheckCircle2 className="size-5" /></span><div><p className="text-sm font-semibold text-emerald-950">No AI suggestions for this version</p><p className="mt-1 text-xs leading-5 text-emerald-900">The AI review found no issues to suggest. This does not guarantee legal or regulatory compliance.</p></div></div>}
      {!!mine.length && <ul className="space-y-3">{sortBySeverity(mine).map((f, index) => { const v = verdict[f.outcome] ?? verdict['cannot_verify']!; const also = overlaps.get(f.id); const b = box(f.bbox); const actions = renderActions?.(f); const tone = f.outcome === 'supported' ? 'border-l-emerald-500' : f.outcome === 'cannot_verify' ? 'border-l-amber-500' : 'border-l-rose-500'; const iconTone = f.outcome === 'supported' ? 'text-emerald-700' : f.outcome === 'cannot_verify' ? 'text-amber-700' : 'text-rose-700'; return <li key={f.id} className={`overflow-hidden rounded-xl border border-slate-200 border-l-4 bg-white shadow-sm ${tone}`}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3"><span className="flex size-6 items-center justify-center rounded-md bg-white text-[10px] font-semibold text-slate-500 shadow-sm">{String(index + 1).padStart(2, '0')}</span><v.icon className={`size-4 ${iconTone}`} /><Badge variant={v.variant} className={v.tone}>{v.label}</Badge><Badge variant="outline" className={`capitalize ${severityTone[f.severity] ?? 'border-slate-200 bg-slate-50 text-slate-700'}`}>{f.severity}</Badge><Badge variant="outline" className="border-slate-200 bg-white text-slate-600 capitalize">{f.category}</Badge></div>
        <div className="p-4 sm:p-5"><blockquote className={`border-l-2 pl-3 text-sm font-medium leading-6 text-slate-900 ${f.outcome === 'supported' ? 'border-emerald-400' : f.outcome === 'cannot_verify' ? 'border-amber-400' : 'border-rose-400'}`}>“{f.quoted_text}”</blockquote>
          <p className="mt-3 text-sm leading-6 text-slate-700">{f.explanation}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500"><span>{f.evidence_kind === 'image_ocr' ? (b ? `Image area ${boxes.findIndex(x => x.f.id === f.id) + 1}` : 'Image text') : `Characters ${f.span_start}–${f.span_end}`}</span><span className="text-slate-300">·</span><span>Model confidence {Math.round(f.confidence * 100)}%</span></div>
          {f.cited_kind !== 'none' && f.cited_code ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800"><CheckCircle2 className="size-3.5" />Verified source <span className="text-emerald-300">/</span> {f.cited_kind === 'fact' ? 'Approved fact' : f.cited_kind === 'rule' ? 'Brand rule' : 'Glossary term'} <span className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[10px] tracking-normal">{f.cited_code}</span></p><p className="mt-2 text-sm leading-5 text-emerald-950">“{f.cited_passage}”</p></div>
            : <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><HelpCircle className="mt-0.5 size-4 shrink-0 text-amber-700" /><span><strong>No verified citation.</strong> Check this suggestion against approved sources before relying on it.</span></div>}
          {f.suggested_text && <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-800"><Sparkles className="size-3.5" />Suggested wording</p><p className="mt-2 text-sm leading-5 text-blue-950">{f.suggested_text}</p></div>}
          {also && <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-900"><span className="font-semibold">Also flagged by automatic checks:</span> {[...new Set(also.map(d => checkLabel[d.check_name] ?? d.check_name))].join(', ')}</p>}
          {actions && <div className="mt-4 border-t border-slate-100 pt-4">{actions}</div>}
        </div>
      </li>; })}</ul>}
    </div>
  </section>;
}

function Metric({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return <div className={`rounded-xl border p-3 ${tone}`}><div className="flex items-center gap-2">{icon}<span className="truncate text-[10px] font-semibold uppercase tracking-[0.09em]">{label}</span></div><p className="mt-2 text-2xl font-semibold leading-none">{value}</p></div>;
}
