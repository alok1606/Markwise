import { createFileRoute } from '@tanstack/react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { Activity, Bot, ChevronLeft, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/components/app-shell';
import { canManageUsers, meta } from '@/lib/access';
import { listAiCalls } from '@/lib/ai-calls.functions';
import { aiCallStatuses, errorLabel, pageCount, shortRef, statusTone } from '@/lib/ai-calls';

export const Route = createFileRoute('/_authenticated/ai-calls')({ head: () => meta('AI call log', 'Administrator view of every AI review attempt in this workspace.'), component: AiCallsPage });

function AiCallsPage() {
  const ws = useWorkspace();
  if (!canManageUsers(ws.role)) return <><ShieldCheck className="size-8 text-primary" /><h1 className="mt-5 text-2xl font-semibold">Administrator access required</h1><p className="mt-3 text-muted-foreground">Only your workspace administrator can view the AI call log.</p></>;
  return <AiCallLog key={ws.id} workspaceId={ws.id} />;
}

const TONE = { good: 'border-emerald-200 bg-emerald-50 text-emerald-800', bad: 'border-rose-200 bg-rose-50 text-rose-800', other: 'border-slate-200 bg-slate-100 text-slate-700' } as const;

function AiCallLog({ workspaceId }: { workspaceId: string }) {
  const list = useServerFn(listAiCalls);
  const [page, setPage] = useState(1); const [status, setStatus] = useState<(typeof aiCallStatuses)[number]>('all'); const [text, setText] = useState(''); const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => { setQ(text); setPage(1); }, 300); return () => clearTimeout(t); }, [text]);
  const r = useQuery({ queryKey: ['ai-calls', workspaceId, page, status, q], queryFn: () => list({ data: { workspace_id: workspaceId, page, status, q } }), placeholderData: keepPreviousData, retry: false });
  const pages = pageCount(r.data?.total ?? 0);
  return <div className="mx-auto max-w-[1440px]">
    <header className="mb-7 border-b border-slate-200 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700"><span className="size-1.5 rounded-full bg-teal-600" />Workspace administration</p><h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.1rem]">AI call log</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">An immutable audit trail of AI review attempts in this workspace.</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-600"><Activity className="size-4 text-teal-700" />Workspace audit</div></div>
      <div className="mt-5 flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-blue-700 shadow-sm"><ShieldCheck className="size-4" /></div><div><p className="text-sm font-semibold text-slate-900">Content stays private</p><p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600">Summaries describe the request type, size, and knowledge used without exposing submitted text. Content is shown by reference only; administrators do not have access to the content itself. Audit records cannot be edited.</p></div></div>
    </header>
    <section aria-label="Search and filter AI calls" className="mb-5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex sm:items-center sm:gap-3">
      <div className="relative min-w-0 flex-1"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Search the AI call log" placeholder="Search model, error, summary or content ID" value={text} onChange={e => setText(e.target.value)} className="border-0 bg-slate-50 pl-9 shadow-none focus-visible:ring-1" /></div>
      <div className="mt-3 flex flex-wrap gap-2 sm:mt-0" role="group" aria-label="Filter by status">{aiCallStatuses.map(s => <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} aria-pressed={status === s} className={status === s ? 'rounded-lg bg-slate-900 text-white hover:bg-slate-800' : 'rounded-lg border-slate-200 bg-white text-slate-600'} onClick={() => { setStatus(s); setPage(1); }}>{s === 'all' ? 'All attempts' : s === 'succeeded' ? 'Succeeded' : 'Failed'}</Button>)}</div>
    </section>
    {r.data && <p className="mb-3 px-1 text-xs text-slate-500">{r.data.total} matching {r.data.total === 1 ? 'attempt' : 'attempts'}{q || status !== 'all' ? ' for the current search and filter' : ''}</p>}
    <div>
      {r.isPending ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading AI audit records…</div>
        : r.error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{r.error instanceof Error ? r.error.message : 'The AI call log could not be loaded'}. <Button variant="link" className="h-auto p-0 text-rose-900" onClick={() => void r.refetch()}>Try again</Button></p>
        : !r.data.rows.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-9 text-center"><div className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Bot className="size-5" /></div><p className="mt-3 text-sm font-semibold text-slate-900">{q || status !== 'all' ? 'No matching attempts' : 'No AI calls yet'}</p><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-600">{q || status !== 'all' ? 'Try a different search or status filter.' : 'An audit entry appears here whenever an AI review is attempted on submitted content.'}</p></div>
        : <ul className="space-y-3">{r.data.rows.map(c => { const tone = statusTone(c.status); return <li key={c.id} className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${tone === 'bad' ? 'border-l-4 border-l-rose-500' : tone === 'good' ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-slate-300'}`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5"><Badge variant="outline" className={`rounded-full px-2.5 ${TONE[tone]}`}>{c.status === 'succeeded' ? 'Succeeded' : c.status === 'failed' ? 'Failed' : c.status}</Badge>
              {c.error_kind && <span className="text-xs font-medium text-rose-700">{errorLabel(c.error_kind)}</span>}
              <time className="ml-auto text-xs text-slate-500" dateTime={c.created_at}>{new Date(c.created_at).toLocaleString()}</time></div>
            <div className="p-4 sm:p-5"><dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Content reference</dt><dd className="mt-1 font-mono text-sm text-slate-800" title={c.content_id}>{shortRef(c.content_id)}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Provider · model</dt><dd className="mt-1 break-all text-sm text-slate-800">{c.provider} · {c.model}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Prompt version</dt><dd className="mt-1 text-sm text-slate-800">{c.prompt_version || 'Not recorded'}</dd></div>
            </dl>
            <div className="mt-4 rounded-lg bg-slate-50 px-3.5 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Content-free request summary</p><p className="mt-1.5 break-words text-sm leading-6 text-slate-700">{c.what_was_sent_summary}</p></div></div>
          </li>; })}</ul>}
    </div>
    {!!r.data?.total && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><span className="text-slate-500">Page {page} of {pages} <span className="mx-1 text-slate-300">·</span> {r.data.total} total matching</span>
      <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft />Previous</Button><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next<ChevronRight /></Button></div></div>}
  </div>;
}
