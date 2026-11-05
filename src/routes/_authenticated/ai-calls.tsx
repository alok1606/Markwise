import { createFileRoute } from '@tanstack/react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
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

const TONE = { good: 'border-primary text-primary', bad: 'border-destructive text-destructive', other: 'text-muted-foreground' } as const;

function AiCallLog({ workspaceId }: { workspaceId: string }) {
  const list = useServerFn(listAiCalls);
  const [page, setPage] = useState(1); const [status, setStatus] = useState<(typeof aiCallStatuses)[number]>('all'); const [text, setText] = useState(''); const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => { setQ(text); setPage(1); }, 300); return () => clearTimeout(t); }, [text]);
  const r = useQuery({ queryKey: ['ai-calls', workspaceId, page, status, q], queryFn: () => list({ data: { workspace_id: workspaceId, page, status, q } }), placeholderData: keepPreviousData, retry: false });
  const pages = pageCount(r.data?.total ?? 0);
  return <>
    <p className="mb-3 text-xs font-semibold uppercase text-primary">Workspace administration</p>
    <h1 className="text-3xl font-semibold">AI call log</h1>
    <p className="mt-3 max-w-2xl text-muted-foreground">Every AI review attempt in this workspace. Records cannot be edited. Summaries describe what was sent (type, size, number of rules and facts) without the content itself. Content is shown by reference only, because administrators do not have access to content.</p>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input aria-label="Search the AI call log" placeholder="Search model, error, summary or full content ID" value={text} onChange={e => setText(e.target.value)} className="sm:max-w-sm" />
      <div className="flex gap-2" role="group" aria-label="Filter by status">{aiCallStatuses.map(s => <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }}>{s === 'all' ? 'All' : s === 'succeeded' ? 'Succeeded' : 'Failed'}</Button>)}</div>
    </div>
    <div className="mt-6">
      {r.isPending ? <p className="text-sm text-muted-foreground">Loading…</p>
        : r.error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-sm">{r.error instanceof Error ? r.error.message : 'The AI call log could not be loaded'}. <Button variant="link" className="h-auto p-0" onClick={() => void r.refetch()}>Try again</Button></p>
        : !r.data.rows.length ? <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground"><Bot className="mb-2 size-5" />{q || status !== 'all' ? 'No AI calls match this search or filter.' : 'No AI calls yet. An entry appears here each time an AI review is attempted on submitted content.'}</div>
        : <ul className="space-y-3">{r.data.rows.map(c => { const tone = statusTone(c.status); return <li key={c.id} className="rounded-lg border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={TONE[tone]}>{c.status === 'succeeded' ? 'Succeeded' : c.status === 'failed' ? 'Failed' : c.status}</Badge>
              {c.error_kind && <span className="text-destructive">{errorLabel(c.error_kind)}</span>}
              <time className="ml-auto text-xs text-muted-foreground" dateTime={c.created_at}>{new Date(c.created_at).toLocaleString()}</time></div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">Content</dt><dd className="font-mono" title={c.content_id}>{shortRef(c.content_id)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Provider · model</dt><dd className="break-all">{c.provider} · {c.model}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Prompt version</dt><dd>{c.prompt_version || 'Not recorded'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Duration</dt><dd className="text-muted-foreground">Not recorded</dd></div>
            </dl>
            <p className="mt-3 break-words text-muted-foreground"><span className="text-foreground">Sent: </span>{c.what_was_sent_summary}</p>
          </li>; })}</ul>}
    </div>
    {!!r.data?.total && <div className="mt-4 flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">{r.data.total} call{r.data.total === 1 ? '' : 's'} · page {page} of {pages}</span>
      <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft />Previous</Button><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next<ChevronRight /></Button></div></div>}
  </>;
}
