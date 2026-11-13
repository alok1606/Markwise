import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Activity, AlertTriangle, BarChart3, Check, ChevronRight, CircleAlert, Clock3, Play, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/components/app-shell';
import { AccessRequired } from '@/components/content/content-ui';
import { ACCURACY_CASES, ACCURACY_DATASET_VERSION } from '@/lib/accuracy-dataset';
import { type CitationMetrics, type EvaluatedMetrics, type EvaluationMetrics, type FindingMismatch } from '@/lib/accuracy-evaluation';
import { accuracyRunOptions, accuracyRunsOptions } from '@/lib/content-queries';
import { createAccuracyRun, processAccuracyBatch } from '@/lib/accuracy-evaluation.functions';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/accuracy')({
  head: () => meta('Accuracy', 'Measured workspace evaluation of Markwise deterministic and AI review checks.'),
  component: AccuracyPage,
});

type RunRow = { id: string; status: string; dataset_version: string; dataset_sha256: string; evaluator_version: string; model: string; prompt_version: string; total_cases: number; completed_cases: number; ai_calls: number; metrics: unknown; error_summary: string | null; created_at: string; started_at: string | null; completed_at: string | null };
type ResultRow = { id: string; case_key: string; case_title: string; input_text: string; deterministic_status: string; ai_status: string; expected_deterministic: unknown; predicted_deterministic: unknown; expected_ai: unknown; predicted_ai: unknown; ai_error: string | null; unguided_ai_status: string | null; predicted_ai_unguided: unknown; unguided_ai_error: string | null; ai_call_count: number; duration_ms: number };

function AccuracyPage() {
  const ws = useWorkspace();
  const isAdmin = ws.role === 'admin';
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const runsQuery = useQuery({ ...accuracyRunsOptions(ws.id), enabled: !!ws.id && isAdmin });
  const runs = (runsQuery.data ?? []) as RunRow[];
  useEffect(() => {
    if (!selectedRunId && runs.length) setSelectedRunId(runs[0]!.id);
  }, [runs, selectedRunId]);
  const detailQuery = useQuery({
    ...accuracyRunOptions(ws.id, selectedRunId),
    enabled: !!ws.id && !!selectedRunId && isAdmin,
    refetchInterval: query => ['queued', 'running'].includes((query.state.data as { run?: RunRow } | undefined)?.run?.status ?? '') ? 1800 : false,
  });
  if (!isAdmin) return <AccessRequired message="Only an administrator of the selected workspace can view accuracy evaluations." />;

  const selected = detailQuery.data as { run: RunRow; results: ResultRow[] } | undefined;
  const run = selected?.run;
  const metrics = run?.metrics as EvaluatedMetrics | null | undefined;
  const pairedMetricsAvailable = !!metrics && 'unguided_ai' in metrics && 'citations' in metrics && 'cannot_verify' in metrics;

  async function startEvaluation() {
    if (working || !ws.id) return;
    setWorking(true); setMessage('Preparing the labelled dataset…');
    try {
      const created = await createAccuracyRun({ data: { workspace_id: ws.id } }) as RunRow;
      setSelectedRunId(created.id);
      setMessage(`Running Markwise checks · 0 of ${created.total_cases} examples complete`);
      for (let batch = 0; batch < Math.ceil(created.total_cases / 2) + 2; batch++) {
        const result = await processAccuracyBatch({ data: { workspace_id: ws.id, run_id: created.id } });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['accuracy', 'runs', ws.id] }),
          queryClient.invalidateQueries({ queryKey: ['accuracy', 'run', ws.id, created.id] }),
        ]);
        if (result.locked) {
          setMessage('This run is already being processed in another session. Its status will refresh automatically.');
          break;
        }
        if (result.terminal) { setMessage('Evaluation results saved.'); break; }
        setMessage(`Running Markwise checks · ${result.completed_cases ?? 0} of ${result.total_cases ?? created.total_cases} examples complete`);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Evaluation could not be started';
      setMessage(text); toast.error(text);
      await queryClient.invalidateQueries({ queryKey: ['accuracy', 'runs', ws.id] });
    } finally {
      setWorking(false);
      await queryClient.invalidateQueries({ queryKey: ['accuracy', 'runs', ws.id] });
      await queryClient.invalidateQueries({ queryKey: ['accuracy', 'run', ws.id, selectedRunId] });
    }
  }

  const terminal = run && ['completed', 'partial', 'failed'].includes(run.status);
  const active = run && ['queued', 'running'].includes(run.status);
  const progress = run?.total_cases ? Math.round((run.completed_cases / run.total_cases) * 100) : 0;

  return <div className="mx-auto max-w-[1320px] space-y-7">
    <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 lg:flex-row lg:items-end">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue">Admin · Measurement</p>
        <h1 className="text-3xl font-semibold tracking-tight text-brand-ink sm:text-4xl">Accuracy evaluations</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Run the production deterministic checks and AI citation validator against a fixed, manually labelled fictional dataset. Results are stored per workspace and are never edited into content reviews.</p>
      </div>
      <Button onClick={() => void startEvaluation()} disabled={working || !!active} className="min-h-11 shrink-0 gap-2">
        {working ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
        {working ? 'Evaluation running' : active ? 'Evaluation in progress' : 'Run evaluation'}
      </Button>
    </header>

    <section className="grid gap-4 md:grid-cols-3" aria-label="Evaluation details">
      <InfoCard icon={ShieldCheck} label="Labelled dataset" value={`${ACCURACY_CASES.length} examples`} detail={`${ACCURACY_DATASET_VERSION} · hand-labelled fixtures`} />
      <InfoCard icon={Activity} label="AI safety limits" value="≤ 300 per run" detail="25 maximum per batch · guided/control pair · no retries" />
      <InfoCard icon={Clock3} label="Workspace scope" value={ws.name} detail="Visible to administrators in this workspace only" />
    </section>

    {(working || active || message) && <section className="rounded-xl border border-brand-blue/20 bg-brand-blue/[0.04] p-4" aria-live="polite">
      <div className="flex items-start gap-3"><Activity className={`mt-0.5 size-4 text-brand-blue ${working || active ? 'animate-pulse' : ''}`} /><div className="min-w-0 flex-1">
        <p className="font-medium text-brand-ink">{message || `Evaluation ${run?.status ?? 'queued'}`}</p>
        {run && <><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-blue transition-[width] duration-300" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{run.completed_cases} / {run.total_cases} cases · {run.ai_calls} AI attempts</p></>}
      </div></div>
    </section>}

    <div className="grid gap-6 xl:grid-cols-[minmax(250px,0.75fr)_minmax(0,2fr)]">
      <aside className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Previous runs</h2><Badge variant="outline">{runs.length}</Badge></div>
        {runsQuery.isPending ? <p className="py-8 text-center text-sm text-muted-foreground">Loading saved evaluations…</p>
          : runsQuery.error ? <p className="py-8 text-center text-sm text-destructive">Could not load evaluation history.</p>
          : !runs.length ? <div className="my-5 rounded-lg border border-dashed p-5 text-center"><BarChart3 className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No runs yet</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Start an evaluation to create the first reproducible report for {ws.name}.</p></div>
          : <ul className="mt-3 space-y-2">{runs.map(item => <li key={item.id}><button type="button" onClick={() => { setSelectedRunId(item.id); setMessage(''); }} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedRunId === item.id ? 'border-brand-blue/40 bg-brand-blue/[0.05]' : 'border-transparent hover:border-border hover:bg-muted/50'}`}>
            <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{new Date(item.created_at).toLocaleString()}</span><RunStatus status={item.status} /></span>
            <span className="mt-1 block text-xs text-muted-foreground">{item.completed_cases}/{item.total_cases} cases · {item.ai_calls} AI attempts</span>
            <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">{item.dataset_sha256}</span>
          </button></li>)}</ul>}
      </aside>

      <main className="min-w-0 space-y-6">
        {!run && <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center"><BarChart3 className="size-8 text-brand-blue" /><h2 className="mt-3 text-lg font-semibold">Measured, not assumed</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Each labelled example runs twice through the same model: once with the fictional workspace guidance and once with an empty source context. Both passes use Markwise’s citation and span validator. The comparison describes this dataset and does not promise a general accuracy gain.</p></div>}
        {detailQuery.isPending && selectedRunId && <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Loading saved report…</p>}
        {detailQuery.error && <p role="alert" className="rounded-xl border border-destructive/30 p-5 text-sm text-destructive">This evaluation report could not be loaded.</p>}
        {run && <>
          <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5">
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">Run report</h2><RunStatus status={run.status} /></div><p className="mt-1 text-sm text-muted-foreground">{run.dataset_version} · {new Date(run.created_at).toLocaleString()}</p><p className="mt-2 max-w-full break-all font-mono text-[11px] text-muted-foreground">Dataset SHA-256: {run.dataset_sha256}</p></div>
            <div className="text-right text-xs text-muted-foreground"><p>Model: <span className="font-medium text-foreground">{run.model}</span></p><p className="mt-1">Prompt: {run.prompt_version} · Evaluator: {run.evaluator_version}</p><p className="mt-1">AI attempts: {run.ai_calls} / 300</p></div>
          </section>
          {run.error_summary && <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>{run.error_summary}</p></div>}
          {metrics && <>
            <div className="grid gap-4 md:grid-cols-2">
              <MetricPanel title="Deterministic checks" subtitle="Run through the same pure checks used on submitted text." metrics={metrics.deterministic} tone="blue" />
              <MetricPanel title="Guided AI review" subtitle={`${metrics.ai_cases_measured} examples measured · ${metrics.ai_cases_failed} guided failures excluded · category × outcome labels per example`} metrics={metrics.ai} tone="teal" />
            </div>
            {pairedMetricsAvailable ? <>
              <MetricPanel title="Unguided model control" subtitle={`${metrics.unguided_ai_cases_measured} examples measured · ${metrics.unguided_ai_cases_failed} control failures excluded · same model, no workspace sources · category × outcome labels`} metrics={metrics.unguided_ai} tone="blue" />
              <section className="grid gap-4 lg:grid-cols-3" aria-label="Citation and classification quality">
                <QualityPanel title="Guided citation verification" data={metrics.citations.guided} cannotVerify={metrics.cannot_verify.guided} />
                <QualityPanel title="Unguided citation verification" data={metrics.citations.unguided} cannotVerify={metrics.cannot_verify.unguided} />
              <div className="rounded-xl border border-border bg-card p-5"><h3 className="font-semibold">Guided vs unguided F1</h3><p className="mt-1 text-xs text-muted-foreground">Paired cases where both calls completed; descriptive only. F1 uses category × outcome labels; exact quote mismatches remain visible below.</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-blue-50 p-3 text-blue-900"><p className="text-[11px]">Guided</p><p className="mt-1 text-xl font-semibold">{percent(metrics.guided_vs_unguided.guided_f1)}</p></div><div className="rounded-lg bg-slate-100 p-3 text-slate-800"><p className="text-[11px]">Unguided</p><p className="mt-1 text-xl font-semibold">{percent(metrics.guided_vs_unguided.unguided_f1)}</p></div></div><p className="mt-3 text-xs text-muted-foreground">Δ {metrics.guided_vs_unguided.f1_delta >= 0 ? '+' : ''}{percent(metrics.guided_vs_unguided.f1_delta)} · {metrics.guided_vs_unguided.comparable_cases} paired cases</p></div>
              </section>
            </> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This saved run predates the paired guided/control methodology. Its historical results remain available; rerun the current labelled dataset to produce citation and cannot-verify metrics.</p>}
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3"><BarChart3 className="mt-0.5 size-5 text-brand-blue" /><div><h3 className="font-semibold">Per-rule performance</h3><p className="mt-1 text-xs text-muted-foreground">Accuracy, precision, recall and F1 measure whether each labelled check category was identified per example. False finding details are listed below.</p></div></div>
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-4 font-medium">Check</th><th className="px-2 py-2">Accuracy</th><th className="px-2 py-2">Precision</th><th className="px-2 py-2">Recall</th><th className="px-2 py-2">F1</th><th className="px-2 py-2">TP / FP / FN</th></tr></thead><tbody>{metrics.per_rule.map(row => <tr key={row.rule} className="border-b last:border-0"><td className="py-3 pr-4 font-medium">{checkLabel(row.rule)}</td><td className="px-2 py-3">{percent(row.metrics.accuracy)}</td><td className="px-2 py-3">{percent(row.metrics.precision)}</td><td className="px-2 py-3">{percent(row.metrics.recall)}</td><td className="px-2 py-3">{percent(row.metrics.f1)}</td><td className="px-2 py-3 text-xs text-muted-foreground">{row.metrics.true_positives} / {row.metrics.false_positives} / {row.metrics.false_negatives}</td></tr>)}</tbody></table></div>
            </section>
            <MismatchPanel title="False positives" description="Predicted findings without an exact matching label. A category match with the wrong quote or outcome is still shown as a mismatch." deterministic={metrics.false_positives.deterministic} ai={metrics.false_positives.ai} unguided={metrics.false_positives.unguided_ai} empty="No false positives in the measured results." />
            <MismatchPanel title="False negatives" description="Expected labelled findings that a model pass did not reproduce exactly." deterministic={metrics.false_negatives.deterministic} ai={metrics.false_negatives.ai} unguided={metrics.false_negatives.unguided_ai} empty="No false negatives in the measured results." />
          </>}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Case results</h3><p className="mt-1 text-xs text-muted-foreground">Submitted text and outputs from the actual review functions.</p></div><Badge variant="outline">{selected?.results.length ?? 0} / {run.total_cases}</Badge></div>
            <div className="mt-4 space-y-3">{(selected?.results ?? []).map(result => <details key={result.id} className="rounded-lg border border-border p-4 open:bg-muted/20"><summary className="flex cursor-pointer list-none items-center gap-2 font-medium"><ChevronRight className="size-4 text-muted-foreground transition-transform [details[open]_&]:rotate-90" />{result.case_title}<span className="ml-auto flex flex-wrap justify-end gap-2"><Badge variant={result.deterministic_status === 'completed' ? 'secondary' : 'destructive'}>Checks {result.deterministic_status}</Badge><Badge variant={result.ai_status === 'completed' ? 'secondary' : 'destructive'}>Guided {result.ai_status}</Badge>{result.unguided_ai_status && <Badge variant={result.unguided_ai_status === 'completed' ? 'secondary' : 'destructive'}>Unguided {result.unguided_ai_status}</Badge>}<Badge variant="outline">{result.ai_call_count} model calls</Badge></span></summary>
              <div className="mt-3 border-t pt-3"><p className="whitespace-pre-wrap text-sm leading-6">{result.input_text}</p><ResultFindings title="Expected checks" value={result.expected_deterministic} /><ResultFindings title="Predicted checks" value={result.predicted_deterministic} /><ResultFindings title="Expected AI findings" value={result.expected_ai} /><ResultFindings title="Guided · validated findings" value={result.predicted_ai} /><ResultFindings title="Unguided · validated findings" value={result.predicted_ai_unguided} />{result.ai_error && <p className="mt-2 text-xs text-amber-800">Guided AI result unavailable: {result.ai_error}</p>}{result.unguided_ai_error && <p className="mt-2 text-xs text-amber-800">Unguided control unavailable: {result.unguided_ai_error}</p>}</div>
            </details>)}{!selected?.results.length && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No case results have been saved yet.</p>}</div>
          </section>
          {terminal && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="size-3.5 text-emerald-600" />Report saved in {ws.name}. Run another evaluation to create a new immutable history entry.</p>}
        </>}
      </main>
    </div>
  </div>;
}

function InfoCard({ icon: Icon, label, value, detail }: { icon: typeof ShieldCheck; label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="size-4 text-brand-blue" />{label}</div><p className="mt-3 truncate text-lg font-semibold text-brand-ink">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>;
}

function RunStatus({ status }: { status: string }) {
  const style = status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : status === 'partial' ? 'border-amber-200 bg-amber-50 text-amber-900' : status === 'failed' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800';
  return <Badge variant="outline" className={`capitalize ${style}`}>{status === 'running' && <Activity className="mr-1 size-3" />}{status}</Badge>;
}

function MetricPanel({ title, subtitle, metrics, tone }: { title: string; subtitle: string; metrics: EvaluationMetrics; tone: 'blue' | 'teal' }) {
  const color = tone === 'blue' ? 'text-blue-700 bg-blue-50' : 'text-teal-700 bg-teal-50';
  return <section className="rounded-xl border border-border bg-card p-5"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Accuracy', metrics.accuracy], ['Precision', metrics.precision], ['Recall', metrics.recall], ['F1 score', metrics.f1]].map(([label, value]) => <div key={String(label)} className={`rounded-lg p-3 ${color}`}><p className="text-[11px] font-medium opacity-75">{String(label)}</p><p className="mt-1 text-xl font-semibold">{percent(Number(value))}</p></div>)}</div><p className="mt-3 text-xs text-muted-foreground">TP {metrics.true_positives} · FP {metrics.false_positives} · FN {metrics.false_negatives} · TN {metrics.true_negatives} · {metrics.samples} labelled decisions</p></section>;
}

function MismatchPanel({ title, description, deterministic, ai, unguided = [], empty }: { title: string; description: string; deterministic: FindingMismatch[]; ai: FindingMismatch[]; unguided?: FindingMismatch[]; empty: string }) {
  const all = [...deterministic.map(x => ({ ...x, engine: 'Deterministic' })), ...ai.map(x => ({ ...x, engine: 'Guided AI' })), ...unguided.map(x => ({ ...x, engine: 'Unguided AI' }))];
  return <section className="rounded-xl border border-border bg-card p-5"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 size-5 text-amber-600" /><div><h3 className="font-semibold">{title} <span className="text-muted-foreground">({all.length})</span></h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>{!all.length ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{empty}</p> : <ul className="mt-4 space-y-2">{all.map((row, index) => <li key={`${row.engine}-${row.case_id}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{row.engine}</Badge><span className="text-sm font-medium">{row.title}</span></div><p className="mt-2 text-sm"><span className="font-mono">“{row.quoted_text || '(no quoted text)'}”</span><span className="ml-2 text-xs text-muted-foreground">{row.label} · {row.outcome}</span></p></li>)}</ul>}</section>;
}

function QualityPanel({ title, data, cannotVerify }: { title: string; data: CitationMetrics; cannotVerify: EvaluationMetrics }) {
  return <section className="rounded-xl border border-border bg-card p-5"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">Citation status comes from the exact source context supplied to each pass. Verified means the cited source and passage exist in that context; it is not a claim of independent semantic proof.</p><div className="mt-4 grid grid-cols-2 gap-2"><QualityValue label="Verified citations" value={data.verified_citations} tone="good" /><QualityValue label="Invalid attempts" value={data.invalid_citation_attempts} tone={data.invalid_citation_attempts ? 'bad' : 'neutral'} /><QualityValue label="Missing required" value={data.missing_required_citations} tone={data.missing_required_citations ? 'warn' : 'neutral'} /><QualityValue label="Unverifiable attempts" value={data.unverifiable_citation_attempts} tone="neutral" /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Expected citation claims {data.expected_citations} · invalid-attempt rate {percent(data.hallucinated_citation_rate)} of verifiable citation attempts. Invalid/missing citations are not counted as verified.</p><div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3"><QualityStat label="Citation precision" value={data.verification.precision} /><QualityStat label="Citation recall" value={data.verification.recall} /><QualityStat label="Citation F1" value={data.verification.f1} /></div><div className="mt-4 border-t pt-3"><p className="text-xs font-semibold">“Cannot verify” classification</p><p className="mt-1 text-xs text-muted-foreground">Precision {percent(cannotVerify.precision)} · Recall {percent(cannotVerify.recall)} · F1 {percent(cannotVerify.f1)} · TP/FP/FN {cannotVerify.true_positives}/{cannotVerify.false_positives}/{cannotVerify.false_negatives}</p></div></section>;
}

function QualityStat({ label, value }: { label: string; value: number }) { return <div><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold text-brand-navy">{percent(value)}</p></div>; }

function QualityValue({ label, value, tone }: { label: string; value: number; tone: 'good' | 'bad' | 'warn' | 'neutral' }) {
  const classes = tone === 'good' ? 'bg-emerald-50 text-emerald-800' : tone === 'bad' ? 'bg-rose-50 text-rose-800' : tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700';
  return <div className={`rounded-lg p-3 ${classes}`}><p className="text-[11px] opacity-75">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function ResultFindings({ title, value }: { title: string; value: unknown }) {
  const list = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
  return <div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title} · {list.length}</p>{!list.length ? <p className="mt-1 text-xs text-muted-foreground">No findings</p> : <ul className="mt-1 space-y-1">{list.map((item, index) => <li key={index} className="rounded-md bg-background px-2.5 py-2 text-xs"><span className="font-medium">{String(item['check_name'] ?? item['category'] ?? 'Finding')}</span>{item['quoted_text'] ? <span> · “{String(item['quoted_text'])}”</span> : null}<span className="text-muted-foreground"> · {String(item['outcome'] ?? item['verdict'] ?? '')}{item['citation_status'] ? ` · citation ${String(item['citation_status'])}` : ''}{item['citation_status'] === 'verified' && item['cited_code'] ? ` · ${String(item['cited_code'])}` : ''}</span></li>)}</ul>}</div>;
}

function percent(value: number) { return `${Math.round((Number.isFinite(value) ? value : 0) * 1000) / 10}%`; }
function checkLabel(rule: string) { return ({ banned_term: 'Restricted terms (LEGAL-03)', terminology: 'Approved terminology', numeric_claim: 'Numeric claims' } as Record<string, string>)[rule] ?? rule; }
