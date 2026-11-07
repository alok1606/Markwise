import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, CircleHelp, ClipboardCheck, Download, FileText, ScanLine, Send, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useWorkspace } from '@/components/app-shell';
import { AccessRequired, StatusBadge, TypeIcon } from '@/components/content/content-ui';
import { ContentEditor } from '@/components/content/content-editor';
import { canCreateContent, canReviewAssigned, canViewWorkspaceContent, isEditable, type ContentStatus, type ContentType } from '@/lib/content';
import { contentOptions, reviewersOptions } from '@/lib/content-queries';
import { deleteContentDraft, getVersionFileUrl, runAiReview, runContentChecks, submitContent } from '@/lib/content.functions';
import { actOnFinding, addComment, decideApproval, submitForApproval } from '@/lib/approval.functions';
import { AiReviewPanel } from '@/components/content/ai-review-panel';
import { readImageColours } from '@/lib/image-colours';
import { FindingsPanel, Highlighted } from '@/components/content/findings-panel';
import { ApprovalHistory, CommentsThread, DecisionPanel, FindingResolution, SendForApproval, type ActionRow, type ApprovalRow } from '@/components/content/review-actions';
import type { Decision } from '@/lib/approval';
import { meta } from '@/lib/access';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityTimeline } from '@/components/content/activity-timeline';
import { buildActivity } from '@/lib/activity';

export const Route = createFileRoute('/_authenticated/content/$id')({ head: () => meta('Content review', 'Content, findings, approval and version history.'), component: ContentDetail });

function ContentDetail() {
  const { id } = Route.useParams(); const ws = useWorkspace(); const qc = useQueryClient(); const navigate = useNavigate();
  const allowed = canCreateContent(ws.role) || canViewWorkspaceContent(ws.role) || canReviewAssigned(ws.role);
  const q = useQuery({ ...contentOptions(ws.id, id), enabled: !!ws.id && allowed, retry: false });
  const submit = useServerFn(submitContent); const remove = useServerFn(deleteContentDraft); const versionUrl = useServerFn(getVersionFileUrl); const runChecksFn = useServerFn(runContentChecks); const runAiFn = useServerFn(runAiReview);
  const actFn = useServerFn(actOnFinding); const sendFn = useServerFn(submitForApproval); const decideFn = useServerFn(decideApproval); const commentFn = useServerFn(addComment);
  const [running, setRunning] = useState(false); const [aiRunning, setAiRunning] = useState(false); const [aiError, setAiError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'submit' | 'delete' | null>(null);
  const status0 = q.data?.content.status as ContentStatus | undefined;
  const reviewers = useQuery({ ...reviewersOptions(ws.id), enabled: !!q.data?.is_owner && status0 === 'checked' && q.data?.route_facts?.route === 'reviewer' });
  if (!allowed) return <AccessRequired message="Your role in this workspace has no access to content." />;
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <><h1 className="text-2xl font-semibold">Content not available</h1><p className="mt-3 text-muted-foreground">It may not exist, or you may not have access in this workspace.</p></>;
  const { content: c, versions, reviews, findings, file_url, owner_name, is_owner, actions, approvals, comments, route_facts, names, user_id } = q.data;
  const status = c.status as ContentStatus; const type = c.type as ContentType; const editable = is_owner && isEditable(status);
  const refresh = () => qc.invalidateQueries({ queryKey: ['content'] });
  const actionsByFinding = new Map((actions as ActionRow[]).map(a => [a.finding_id, a]));
  const openApproval = (approvals as ApprovalRow[]).find(a => a.status === 'open') ?? null;
  const canDecide = !!openApproval && !is_owner && ((openApproval.route === 'manager' && ws.role === 'manager') || (openApproval.route === 'reviewer' && ws.role === 'reviewer' && openApproval.reviewer_id === user_id));
  const recheckToasts = (r: { check_error?: string | null; checks?: { findings: number } | null; ai_error?: string | null; ai?: { findings: number } | null } | null) => {
    if (r?.check_error) toast.warning(`Automatic checks did not run: ${r.check_error}`); else if (r?.checks) toast.success(`${r.checks.findings} automatic finding(s)`);
    if (r?.ai_error) { setAiError(r.ai_error); toast.warning(`AI review did not complete: ${r.ai_error}`); } else if (r?.ai) toast.success(`AI review saved · ${r.ai.findings} suggestion(s)`);
  };
  async function act() {
    try {
      if (confirm === 'submit') {
        const img = type === 'image' ? await imageSample() : { colour_samples: null, image_error: null };
        const r = await submit({ data: { workspace_id: ws.id, id, expected_version: c.version, ...img } });
        toast.success('Content submitted'); recheckToasts(r); await refresh();
      }
      if (confirm === 'delete') { await remove({ data: { workspace_id: ws.id, id } }); toast.success('Draft deleted'); await refresh(); await navigate({ to: '/content' }); }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Action failed'); await refresh(); } finally { setConfirm(null); }
  }
  async function imageSample() {
    if (!file_url) return { colour_samples: null, image_error: 'no image file to read' };
    const r = await readImageColours(file_url); return { colour_samples: r.samples, image_error: r.error };
  }
  async function runNow() {
    setRunning(true);
    try { const r = await runChecksFn({ data: { workspace_id: ws.id, id, ...(type === 'image' ? await imageSample() : { colour_samples: null, image_error: null }) } }); toast.success(`${r.findings} automatic finding(s) saved`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Checks failed'); } finally { setRunning(false); await refresh(); }
  }
  async function runAiNow() {
    setAiRunning(true); setAiError(null);
    try { const r = await runAiFn({ data: { workspace_id: ws.id, id } }); if (r.ai_error) { setAiError(r.ai_error); toast.error(r.ai_error); } else toast.success(`AI review saved · ${r.ai?.findings ?? 0} suggestion(s)`); }
    catch (err) { const m = err instanceof Error ? err.message : 'AI review failed'; setAiError(m); toast.error(m); } finally { setAiRunning(false); await refresh(); }
  }
  async function download(versionId: string) {
    try { const { url } = await versionUrl({ data: { workspace_id: ws.id, id, version_id: versionId } }); window.location.assign(url); } catch (err) { toast.error(err instanceof Error ? err.message : 'Download failed'); }
  }
  async function onFindingAction(findingId: string, action: 'accepted' | 'edited' | 'dismissed', opts: { reason?: string; final_text?: string }) {
    setBusy(true);
    try {
      const r = await actFn({ data: { workspace_id: ws.id, id, expected_version: c.version, finding_id: findingId, action, reason: opts.reason ?? null, final_text: opts.final_text ?? null } });
      toast.success(action === 'dismissed' ? 'Finding dismissed' : `Version ${r.version} saved and checked again`); if (action !== 'dismissed') recheckToasts(r); return true;
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Action failed'); return false; } finally { setBusy(false); await refresh(); }
  }
  async function send(reviewerId: string | null) {
    setBusy(true);
    try { await sendFn({ data: { workspace_id: ws.id, id, expected_version: c.version, reviewer_id: reviewerId } }); toast.success('Sent for approval'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not send for approval'); } finally { setBusy(false); await refresh(); }
  }
  async function decide(d: Decision, comment: string) {
    if (!openApproval) return; setBusy(true);
    try { await decideFn({ data: { workspace_id: ws.id, id, approval_id: openApproval.id, expected_version: c.version, decision: d, comment } }); toast.success(d === 'approved' ? 'Approved' : d === 'rejected' ? 'Rejected' : 'Changes requested'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Decision failed'); } finally { setBusy(false); await refresh(); }
  }
  async function post(message: string, parentId: string | null) {
    setBusy(true);
    try { await commentFn({ data: { workspace_id: ws.id, id, parent_id: parentId, message } }); return true; }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Comment failed'); return false; } finally { setBusy(false); await refresh(); }
  }
  const latest = versions.find(v => v.version_number === c.version);
  const rv = reviews.find(r => r.version_number === c.version && r.source === 'deterministic') ?? null;
  const ai = reviews.find(r => r.version_number === c.version && r.source === 'ai') ?? null;
  const latestFindings = findings.filter(f => f.review_id === rv?.id || f.review_id === ai?.id);
  const canActOnFindings = is_owner && status === 'checked';
  const renderActions = (f: { id: string }) => { const full = findings.find(x => x.id === f.id)!; return <FindingResolution f={full} action={actionsByFinding.get(f.id)} names={names} canAct={canActOnFindings} canRewrite={type !== 'image'} busy={busy} onAct={(a, o) => onFindingAction(f.id, a, o)} />; };
  const backTo = is_owner ? '/content' : ws.role === 'reviewer' ? '/review' : '/content/all';
  const automaticFindings = rv ? findings.filter(f => f.review_id === rv.id) : [];
  const aiFindings = ai ? findings.filter(f => f.review_id === ai.id) : [];
  const verifiedCitationCount = aiFindings.filter(f => f.cited_kind !== 'none' && !!f.cited_code).length;
  const aiNeedsCheckingCount = aiFindings.filter(f => f.outcome === 'cannot_verify').length;
  const reviewSnapshot = [
    { label: 'Automatic findings', value: rv ? automaticFindings.length : '—', note: rv ? (automaticFindings.length ? `Saved for v${rv.version_number}` : 'No findings saved') : 'No saved check', Icon: ClipboardCheck, tone: 'border-blue-200 bg-blue-100/70 text-blue-900', iconTone: 'bg-blue-200 text-blue-800' },
    { label: 'AI findings', value: ai ? aiFindings.length : '—', note: ai ? (aiFindings.length ? `Saved for v${ai.version_number}` : 'No findings saved') : 'No AI review saved', Icon: Sparkles, tone: 'border-violet-200 bg-violet-100/70 text-violet-900', iconTone: 'bg-violet-200 text-violet-800' },
    { label: 'Verified citations', value: ai ? verifiedCitationCount : '—', note: ai ? 'Matched to approved sources' : 'No AI review saved', Icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-100/70 text-emerald-900', iconTone: 'bg-emerald-200 text-emerald-800' },
    { label: 'Needs checking', value: ai ? aiNeedsCheckingCount : '—', note: ai ? 'AI findings without verification' : 'No AI review saved', Icon: CircleHelp, tone: 'border-amber-200 bg-amber-100/70 text-amber-950', iconTone: 'bg-amber-200 text-amber-900' },
  ];
  return <div className="mx-auto max-w-[1380px]">
    <Link to={backTo} className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"><span className="flex size-8 items-center justify-center rounded-lg border bg-card transition-colors group-hover:border-brand-blue/30 group-hover:text-brand-blue"><ArrowLeft className="size-4" /></span>{is_owner ? 'My content' : ws.role === 'reviewer' ? 'Review queue' : 'All content'}</Link>

    <section className="mt-5 overflow-hidden rounded-2xl border border-t-4 border-border border-t-brand-blue bg-card shadow-[0_14px_42px_-32px_rgba(15,23,42,0.42)]">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border px-5 py-5 sm:px-7 sm:py-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5"><span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue"><TypeIcon type={type} /></span><span className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">{type} content</span><span className="text-border">/</span><span className="text-sm font-semibold text-brand-navy">Version {c.version}</span><StatusBadge status={status} /></div>
          <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight text-brand-ink sm:text-[2rem]">{c.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"><span>By {owner_name}</span>{c.submitted_at && <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />Submitted {new Date(c.submitted_at).toLocaleString()}</span>}</div>
        </div>
        {editable && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{status === 'draft' && <Button variant="outline" onClick={() => setConfirm('delete')}><Trash2 />Delete draft</Button>}<Button onClick={() => setConfirm('submit')}><Send />{status === 'changes_requested' ? 'Resubmit' : 'Submit'}</Button></div>}
      </div>
      {!editable && status !== 'draft' && <div className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-muted/35 px-5 py-3.5 text-xs sm:px-7">
        <span className="inline-flex items-center gap-2 font-medium text-foreground"><span className={`size-2 rounded-full ${rv ? 'bg-emerald-600' : 'bg-amber-500'}`} />Automatic checks {rv ? 'saved' : 'not run'}</span>
        <span className="inline-flex items-center gap-2 font-medium text-foreground"><span className={`size-2 rounded-full ${ai ? 'bg-emerald-600' : 'bg-slate-300'}`} />AI review {ai ? 'saved' : 'not run'}</span>
        <span className="ml-auto text-muted-foreground">Reviewing version {c.version}; prior versions remain unchanged</span>
      </div>}
    </section>

    {!editable && status !== 'draft' && <section className="mt-4" aria-label="Review snapshot">
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Review snapshot</p><p className="mt-0.5 text-xs text-muted-foreground">Saved results for version {c.version}</p></div></div>
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">{reviewSnapshot.map(({ label, value, note, Icon, tone, iconTone }) => <div key={label} className={`min-w-0 rounded-xl border p-3 sm:p-4 ${tone}`}>
        <div className="flex items-center gap-2"><span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconTone}`}><Icon className="size-4" /></span><p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] sm:text-[11px] sm:tracking-[0.1em]">{label}</p></div>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5"><p className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{value}</p><p className="text-[10px] text-muted-foreground sm:text-[11px]">{note}</p></div>
      </div>)}</div>
    </section>}

    {status === 'changes_requested' && is_owner && <p role="status" className="mt-4 rounded-xl border border-brand-blue/25 bg-brand-blue/5 p-4 text-sm text-brand-navy">Changes were requested. Edit below (each save is a new version), then resubmit to have it checked again.</p>}
    {status === 'rejected' && <p role="status" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">This content was rejected. Rejection is final; it cannot be resubmitted.</p>}

    {!editable && <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(400px,0.98fr)]">
      <section className="overflow-hidden rounded-2xl border border-t-4 border-t-brand-blue bg-card shadow-sm" aria-label="Submitted content">
        <div className="flex items-center justify-between gap-3 border-b bg-blue-50/80 px-5 py-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800 shadow-sm ring-1 ring-blue-200"><FileText className="size-4" /></span><div className="min-w-0"><h2 className="font-semibold text-brand-ink">Submitted content</h2><p className="mt-0.5 text-xs text-muted-foreground">Version {c.version} · highlighted text maps to findings</p></div></div><span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-medium capitalize text-blue-800">{type}</span></div>
        <dl className="grid grid-cols-1 gap-3 border-b bg-slate-50/70 px-5 py-4 text-xs sm:grid-cols-3 sm:px-6"><div className="min-w-0"><dt className="font-medium uppercase tracking-wider text-muted-foreground">Channel</dt><dd className="mt-1 truncate text-sm text-foreground">{c.channel || '—'}</dd></div><div className="min-w-0"><dt className="font-medium uppercase tracking-wider text-muted-foreground">Audience</dt><dd className="mt-1 truncate text-sm text-foreground">{c.audience || '—'}</dd></div><div className="min-w-0"><dt className="font-medium uppercase tracking-wider text-muted-foreground">Goal</dt><dd className="mt-1 truncate text-sm text-foreground">{c.goal || '—'}</dd></div></dl>
        <div className="bg-[#fbfaf6] px-5 py-6 sm:px-8 sm:py-8 xl:max-h-[min(68vh,780px)] xl:overflow-y-auto">
          {type === 'image' && file_url && <img src={file_url} alt={c.alt_text || ''} className="mx-auto max-h-[32rem] rounded-lg border object-contain" />}
          {type === 'image' && <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm"><span className="font-medium text-muted-foreground">Alt text: </span>{c.alt_text || <em>empty</em>}{c.text_color ? ` · text ${c.text_color}` : ''}{c.background_color ? ` · background ${c.background_color}` : ''}</p>}
          {type !== 'image' && <div className="mx-auto max-w-[68ch] font-serif text-[15px] leading-8 text-slate-800">{latest && latestFindings.some(f => f.span_start !== null) ? <Highlighted text={latest.body_text} findings={latestFindings} /> : <p className="whitespace-pre-wrap">{c.body_text || 'No text.'}</p>}</div>}
          {type === 'pdf' && file_url && <a href={file_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-brand-blue hover:bg-muted"><Download className="size-4" />Open original PDF</a>}
          <p className="mt-6 border-t pt-4 text-xs leading-relaxed text-muted-foreground">Showing version {c.version}. Highlights are underlined and match findings for this exact version.{type === 'pdf' ? ' Rewrites change confirmed text, not the original file.' : ''}</p>
        </div>
      </section>

      <div className="min-w-0 space-y-4">
        {status !== 'draft' && <section className="overflow-hidden rounded-2xl border border-t-4 border-t-brand-teal bg-card shadow-sm" aria-label="Review findings and evidence">
          <div className="flex items-start justify-between gap-4 bg-teal-50/75 px-5 py-5 sm:px-6"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">Review analysis</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-brand-ink">Findings & evidence</h2><p className="mt-1 text-sm text-slate-600">Rule-based checks and AI suggestions are shown separately.</p></div><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800 ring-1 ring-teal-200"><ScanLine className="size-5" /></span></div>
          <Tabs defaultValue="automatic" className="mt-5">
            <div className="border-b px-4 sm:px-6"><TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 text-muted-foreground">
              <TabsTrigger value="automatic" className="h-11 shrink-0 gap-2 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-brand-blue data-[state=active]:bg-transparent data-[state=active]:text-brand-blue data-[state=active]:shadow-none"><ClipboardCheck className="size-4" />Automatic <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{rv ? automaticFindings.length : '—'}</span></TabsTrigger>
              <TabsTrigger value="ai" className="h-11 shrink-0 gap-2 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-brand-blue data-[state=active]:bg-transparent data-[state=active]:text-brand-blue data-[state=active]:shadow-none"><Sparkles className="size-4" />AI review <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{ai ? aiFindings.length : '—'}</span></TabsTrigger>
            </TabsList></div>
            <TabsContent value="automatic" className="mt-0 px-4 pb-5 sm:px-6 sm:pb-6"><FindingsPanel review={rv} findings={findings} text={null} canRun={is_owner && status === 'submitted' && !rv} running={running} onRun={() => void runNow()} renderActions={renderActions} /></TabsContent>
            <TabsContent value="ai" className="mt-0 px-4 pb-5 sm:px-6 sm:pb-6"><AiReviewPanel review={ai} findings={findings} deterministic={rv ? findings.filter(f => f.review_id === rv.id) : []} imageUrl={type === 'image' ? file_url : null} canRun={is_owner && (status === 'submitted' || status === 'checked') && !ai} running={aiRunning} onRun={() => void runAiNow()} lastError={aiError} renderActions={renderActions} /></TabsContent>
          </Tabs>
        </section>}
        {is_owner && status === 'checked' && route_facts && <SendForApproval facts={route_facts} reviewers={reviewers.data as { id: string; name: string }[] | undefined} busy={busy} onSend={r => void send(r)} />}
        {canDecide && openApproval && <DecisionPanel approval={openApproval} busy={busy} onDecide={(d, cm) => void decide(d, cm)} />}
        <ApprovalHistory approvals={approvals as ApprovalRow[]} names={names} />
        {status !== 'draft' && <CommentsThread comments={comments} names={names} canComment busy={busy} onPost={post} />}
      </div>
    </div>}

    {editable && <div className="mt-5">{type === 'image' && file_url && <img src={file_url} alt={c.alt_text || ''} className="mb-4 max-h-72 rounded-xl border" />}
      <ContentEditor key={c.version} workspaceId={ws.id} existing={{ id: c.id, version: c.version, type, file_name: c.file_name, fields: { title: c.title, channel: c.channel, audience: c.audience, goal: c.goal, body_text: c.body_text, alt_text: c.alt_text, text_color: c.text_color, background_color: c.background_color } }} onSaved={() => void refresh()} />
      {status === 'changes_requested' && <><ApprovalHistory approvals={approvals as ApprovalRow[]} names={names} /><CommentsThread comments={comments} names={names} canComment busy={busy} onPost={post} /></>}</div>}

    <section className="mt-7 overflow-hidden rounded-2xl border border-t-4 border-t-violet-300 bg-card shadow-sm" aria-label="Version history and activity">
      <div className="border-b bg-violet-50/70 px-5 py-4 sm:px-6"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-800">Record</p><h2 className="mt-1 text-lg font-semibold text-brand-ink">History & activity</h2></div>
      <Tabs defaultValue="versions" className="px-4 py-4 sm:px-6">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-muted/70 p-1 sm:w-auto"><TabsTrigger value="versions" className="gap-2"><FileText className="size-4" />Version history</TabsTrigger><TabsTrigger value="activity" className="gap-2"><CalendarDays className="size-4" />Activity</TabsTrigger></TabsList>
        <TabsContent value="versions" className="mt-4"><p className="text-sm text-muted-foreground">Every saved version is kept and cannot be changed.</p>
          <ol className="mt-4 divide-y overflow-hidden rounded-xl border bg-background">{versions.map(v => <li key={v.id} className="flex flex-wrap items-center gap-3 p-4 text-sm"><span className="rounded-md bg-brand-blue/10 px-2 py-1 font-semibold text-brand-blue">v{v.version_number}</span><div className="min-w-0 flex-1"><p className="truncate font-medium text-foreground">{v.title}{v.file_name ? ` · ${v.file_name}` : ''}</p><p className="mt-1 text-xs text-muted-foreground">{v.change_summary} · {new Date(v.created_at).toLocaleString()}</p></div>{v.file_path && <Button size="sm" variant="outline" onClick={() => void download(v.id)}><Download />File</Button>}</li>)}</ol></TabsContent>
        <TabsContent value="activity" className="mt-4"><p className="mb-4 text-sm text-muted-foreground">Everything that happened to this content, newest first.</p>
          <ActivityTimeline events={buildActivity({ versions, actions: actions as ActionRow[], approvals: approvals as ApprovalRow[], comments, names, ownerId: c.owner_id, ownerName: owner_name, userId: user_id })} /></TabsContent>
      </Tabs>
    </section>
    <AlertDialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm === 'submit' ? 'Submit this content?' : 'Delete this draft?'}</AlertDialogTitle><AlertDialogDescription>{confirm === 'submit' ? 'After submitting, you can no longer edit or delete it.' : 'The draft is removed from your list. Its saved versions are kept for the record.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={act}>{confirm === 'submit' ? 'Submit' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
