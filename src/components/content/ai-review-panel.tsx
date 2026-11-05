import { AlertTriangle, CheckCircle2, HelpCircle, Info, Sparkles, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { overlapsWithDeterministic } from '@/lib/ai-review';

type Finding = { id: string; review_id: string; source?: string | null; check_name: string; category: string; severity: string; confidence: number; span_start: number | null; span_end: number | null; quoted_text: string; explanation: string; cited_kind: string; cited_code: string; cited_passage: string; outcome: string; suggested_text?: string | null; evidence_kind?: string | null; bbox?: unknown };
type Review = { id: string; version_number: number; run_at: string; status: string; dropped_findings_count: number; downgraded_findings_count?: number | null; finding_count: number; limitations: unknown; model?: string | null; evidence_text?: string | null };

const checkLabel: Record<string, string> = { banned_term: 'Banned terms', terminology: 'Terminology', numeric_claim: 'Numeric claims', alt_text: 'Image accessibility', contrast: 'Contrast', palette: 'Palette' };
const verdict: Record<string, { label: string; icon: typeof AlertTriangle; variant: 'destructive' | 'secondary' | 'outline' | 'default' }> = {
  violation: { label: 'Issue', icon: AlertTriangle, variant: 'destructive' },
  contradicted: { label: 'Contradicted by an approved fact', icon: XCircle, variant: 'destructive' },
  supported: { label: 'Supported by an approved fact', icon: CheckCircle2, variant: 'default' },
  cannot_verify: { label: 'Needs checking', icon: HelpCircle, variant: 'secondary' },
};
const box = (b: unknown) => Array.isArray(b) && b.length === 4 && b.every(n => typeof n === 'number') ? b as [number, number, number, number] : null;

export function AiReviewPanel({ review, findings, deterministic, imageUrl, canRun, running, onRun, lastError, renderActions }: { review: Review | null; findings: Finding[]; deterministic: Finding[]; imageUrl: string | null; canRun: boolean; running: boolean; onRun: () => void; lastError: string | null; renderActions?: (f: Finding) => React.ReactNode }) {
  if (!review) return <section className="mt-8 rounded-lg border bg-card p-6">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-4 text-primary" />AI review</h2>
    <p className="mt-1 text-sm text-muted-foreground">No AI review has been saved for the submitted version. The automatic checks above are not affected.</p>
    {lastError && <p role="alert" className="mt-3 rounded-md border border-destructive/40 p-3 text-sm text-destructive">{lastError}</p>}
    {canRun && <Button className="mt-4" onClick={onRun} disabled={running}>{running ? 'Reviewing… this can take a minute' : 'Run AI review'}</Button>}
  </section>;
  const mine = findings.filter(f => f.review_id === review.id);
  const overlaps = overlapsWithDeterministic(mine, deterministic);
  const limitations = Array.isArray(review.limitations) ? review.limitations.filter((x): x is string => typeof x === 'string') : [];
  const boxes = mine.map(f => ({ f, b: box(f.bbox) })).filter(x => x.b);
  return <section className="mt-8 rounded-lg border bg-card p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-4 text-primary" />AI review</h2>
      <span className="text-xs text-muted-foreground">Version {review.version_number} · {new Date(review.run_at).toLocaleString()} · AI-generated suggestions</span></div>
    <p className="mt-1 text-sm text-muted-foreground">Suggestions only — nothing has been changed or approved. A citation is shown only when it was confirmed against this workspace’s approved sources; anything else is marked “Needs checking”.</p>
    {limitations.map(l => <p key={l} className="mt-3 flex gap-2 rounded-md border border-dashed p-3 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-primary" />{l}</p>)}
    {(review.dropped_findings_count > 0 || (review.downgraded_findings_count ?? 0) > 0) && <p className="mt-3 text-xs text-muted-foreground">
      {review.dropped_findings_count} AI result(s) left out because the quoted text did not match exactly · {review.downgraded_findings_count ?? 0} changed to “Needs checking” because their citation could not be confirmed.</p>}
    {imageUrl && boxes.length > 0 && <div className="relative mt-4 inline-block max-w-full"><img src={imageUrl} alt="" className="max-h-96 rounded-md border" />
      {boxes.map(({ f, b }, i) => <span key={f.id} title={f.quoted_text} className="absolute rounded-sm border-2 border-destructive" style={{ left: `${b![0] * 100}%`, top: `${b![1] * 100}%`, width: `${b![2] * 100}%`, height: `${b![3] * 100}%` }}><span className="absolute -top-5 left-0 rounded bg-destructive px-1 text-[10px] text-destructive-foreground">{i + 1}</span></span>)}</div>}
    {review.evidence_text && <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted-foreground">Text the AI read in the image</summary><p className="mt-2 whitespace-pre-wrap rounded-md border bg-muted p-3">{review.evidence_text}</p></details>}
    {!mine.length && <p className="mt-4 flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-primary" />The AI found no issues.</p>}
    <ul className="mt-4 space-y-2">{mine.map(f => { const v = verdict[f.outcome] ?? verdict['cannot_verify']!; const also = overlaps.get(f.id); const b = box(f.bbox); return <li key={f.id} className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2"><v.icon className="size-4" /><q className="font-medium">{f.quoted_text}</q>
        <Badge variant={v.variant}>{v.label}</Badge><Badge variant="outline" className="capitalize">{f.severity}</Badge><Badge variant="outline" className="capitalize">{f.category}</Badge>
        <span className="text-xs text-muted-foreground">{f.evidence_kind === 'image_ocr' ? (b ? `image area ${boxes.findIndex(x => x.f.id === f.id) + 1}` : 'image text') : `characters ${f.span_start}–${f.span_end}`} · confidence {Math.round(f.confidence * 100)}%</span></div>
      <p className="mt-1">{f.explanation}</p>
      {f.cited_kind !== 'none' && f.cited_code ? <p className="mt-1 text-xs text-muted-foreground">Verified citation: {f.cited_kind === 'fact' ? 'fact' : f.cited_kind === 'rule' ? 'rule' : 'glossary term'} <span className="font-medium">{f.cited_code}</span> — “{f.cited_passage}”</p>
        : <p className="mt-1 text-xs text-muted-foreground">No verified citation.</p>}
      {f.suggested_text && <p className="mt-1 text-xs"><span className="text-muted-foreground">Suggested wording: </span>{f.suggested_text}</p>}
      {also && <p className="mt-1 text-xs text-muted-foreground">Also flagged by automatic checks: {[...new Set(also.map(d => checkLabel[d.check_name] ?? d.check_name))].join(', ')}</p>}
      {renderActions?.(f)}
    </li>; })}</ul>
  </section>;
}
