import { AlertTriangle, CheckCircle2, HelpCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Finding = { id: string; review_id: string; check_name: string; severity: string; span_start: number | null; span_end: number | null; quoted_text: string; explanation: string; cited_kind: string; cited_code: string; cited_passage: string; outcome: string };
type Review = { id: string; version_number: number; run_at: string; status: string; dropped_findings_count: number; finding_count: number; limitations: unknown };

const checkLabel: Record<string, string> = { banned_term: 'Banned terms', terminology: 'Terminology', numeric_claim: 'Numeric claims', alt_text: 'Image accessibility', contrast: 'Contrast', palette: 'Palette' };
const order = ['banned_term', 'terminology', 'numeric_claim', 'alt_text', 'contrast', 'palette'];

/** Highlights finding spans using UTF-16 offsets into the exact checked version text. */
function Highlighted({ text, findings }: { text: string; findings: Finding[] }) {
  const spans = findings.filter(f => f.span_start !== null && f.span_end !== null).sort((a, b) => a.span_start! - b.span_start! || b.span_end! - a.span_end!);
  const parts: React.ReactNode[] = []; let at = 0;
  for (const f of spans) {
    if (f.span_start! < at) continue; // overlapping spans: the earliest, longest one is highlighted; all are still listed
    parts.push(text.slice(at, f.span_start!));
    parts.push(<mark key={f.id} title={f.explanation} className={f.outcome === 'cannot_verify' ? 'rounded bg-accent px-0.5 text-accent-foreground' : 'rounded bg-destructive/15 px-0.5 text-foreground underline decoration-destructive'}>{text.slice(f.span_start!, f.span_end!)}</mark>);
    at = f.span_end!;
  }
  parts.push(text.slice(at));
  return <p className="whitespace-pre-wrap text-sm leading-relaxed">{parts}</p>;
}

function Swatch({ hex }: { hex: string }) {
  return /^#[0-9A-F]{6}$/i.test(hex) ? <span aria-hidden className="inline-block size-4 rounded border align-middle" style={{ backgroundColor: hex }} /> : null;
}

export function FindingsPanel({ review, findings, text, canRun, running, onRun }: { review: Review | null; findings: Finding[]; text: string | null; canRun: boolean; running: boolean; onRun: () => void }) {
  if (!review) return <section className="mt-8 rounded-lg border bg-card p-6"><h2 className="text-lg font-semibold">Automatic checks</h2>
    <p className="mt-1 text-sm text-muted-foreground">No automatic checks have been saved for the submitted version yet.</p>
    {canRun && <Button className="mt-4" onClick={onRun} disabled={running}>{running ? 'Checking…' : 'Run automatic checks'}</Button>}</section>;
  const mine = findings.filter(f => f.review_id === review.id);
  const limitations = Array.isArray(review.limitations) ? review.limitations.filter((x): x is string => typeof x === 'string') : [];
  return <section className="mt-8 rounded-lg border bg-card p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Automatic checks</h2><span className="text-xs text-muted-foreground">Version {review.version_number} · {new Date(review.run_at).toLocaleString()} · no AI used</span></div>
    <p className="mt-1 text-sm text-muted-foreground">Rule-based results for the exact submitted version. They cannot be changed. Figures are marked “needs checking”, not as errors.</p>
    {limitations.map(l => <p key={l} className="mt-3 flex gap-2 rounded-md border border-dashed p-3 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-primary" />Could not check: {l}</p>)}
    {review.dropped_findings_count > 0 && <p className="mt-3 text-xs text-muted-foreground">{review.dropped_findings_count} result(s) did not match the text exactly and were left out.</p>}
    {!mine.length && <p className="mt-4 flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-primary" />No issues found by the automatic checks.</p>}
    {text && mine.some(f => f.span_start !== null) && <div className="mt-4 rounded-md border bg-background p-4"><Highlighted text={text} findings={mine} /></div>}
    {order.filter(c => mine.some(f => f.check_name === c)).map(c => <div key={c} className="mt-5"><h3 className="text-sm font-semibold">{checkLabel[c]} <span className="font-normal text-muted-foreground">({mine.filter(f => f.check_name === c).length})</span></h3>
      <ul className="mt-2 space-y-2">{mine.filter(f => f.check_name === c).map(f => <li key={f.id} className="rounded-md border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">{f.outcome === 'cannot_verify' ? <HelpCircle className="size-4 text-muted-foreground" /> : <AlertTriangle className="size-4 text-destructive" />}
          {f.quoted_text && <q className="font-medium">{f.quoted_text}</q>}{c === 'palette' && <Swatch hex={f.quoted_text} />}
          <Badge variant="outline" className="capitalize">{f.severity}</Badge>{f.outcome === 'cannot_verify' && <Badge variant="secondary">Needs checking</Badge>}
          {f.span_start !== null && <span className="text-xs text-muted-foreground">characters {f.span_start}–{f.span_end}</span>}</div>
        <p className="mt-1">{f.explanation}</p>
        {(f.cited_code || f.cited_passage) && <p className="mt-1 text-xs text-muted-foreground">Based on {f.cited_kind === 'rule' ? 'rule' : f.cited_kind === 'glossary' ? 'glossary term' : f.cited_kind === 'palette' ? 'palette colour' : ''} <span className="font-medium">{f.cited_code}</span>{f.cited_kind === 'palette' && <> <Swatch hex={f.cited_passage} /></>}{f.cited_passage ? ` — ${f.cited_passage}` : ''}</p>}
      </li>)}</ul></div>)}
  </section>;
}
