import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowLeft, Download, Send, Trash2 } from 'lucide-react';
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
  return <>
    <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><TypeIcon type={type} /><span className="text-xs uppercase text-muted-foreground">{type} · v{c.version}</span><StatusBadge status={status} /></div><h1 className="mt-2 text-3xl font-semibold">{c.title}</h1><p className="mt-1 text-sm text-muted-foreground">By {owner_name}{c.submitted_at ? ` · submitted ${new Date(c.submitted_at).toLocaleString()}` : ''}</p></div>
      {editable && <div className="flex gap-2">{status === 'draft' && <Button variant="outline" onClick={() => setConfirm('delete')}><Trash2 />Delete draft</Button>}<Button onClick={() => setConfirm('submit')}><Send />{status === 'changes_requested' ? 'Resubmit' : 'Submit'}</Button></div>}</div>
    {status === 'changes_requested' && is_owner && <p role="status" className="mt-4 rounded-md border border-primary/40 bg-card p-3 text-sm">Changes were requested. Edit below (each save is a new version), then resubmit to have it checked again.</p>}
    {status === 'rejected' && <p role="status" className="mt-4 rounded-md border border-destructive/40 bg-card p-3 text-sm">This content was rejected. Rejection is final; it cannot be resubmitted.</p>}
    {!editable && <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-lg border bg-card p-6 lg:sticky lg:top-6 lg:self-start" aria-label="Original content">
        <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">Channel</dt><dd>{c.channel || '—'}</dd></div><div><dt className="text-muted-foreground">Audience</dt><dd>{c.audience || '—'}</dd></div><div><dt className="text-muted-foreground">Goal</dt><dd>{c.goal || '—'}</dd></div></dl>
        {type === 'image' && file_url && <img src={file_url} alt={c.alt_text || ''} className="max-h-96 rounded-md border" />}
        {type === 'image' && <p className="text-sm"><span className="text-muted-foreground">Alt text: </span>{c.alt_text || <em>empty</em>}{c.text_color ? ` · text ${c.text_color}` : ''}{c.background_color ? ` · background ${c.background_color}` : ''}</p>}
        {type !== 'image' && (latest && latestFindings.some(f => f.span_start !== null) ? <Highlighted text={latest.body_text} findings={latestFindings} /> : <p className="whitespace-pre-wrap text-sm">{c.body_text || 'No text.'}</p>)}
        <p className="text-xs text-muted-foreground">Showing version {c.version}. Highlights are underlined and match the findings for this exact version.{type === 'pdf' ? ' For PDFs, rewrites change the confirmed text, not the original file.' : ''}</p>
      </section>
      <div>
        {status !== 'draft' && <>
          <FindingsPanel review={rv} findings={findings} text={null} canRun={is_owner && status === 'submitted' && !rv} running={running} onRun={() => void runNow()} renderActions={renderActions} />
          <AiReviewPanel review={ai} findings={findings} deterministic={rv ? findings.filter(f => f.review_id === rv.id) : []} imageUrl={type === 'image' ? file_url : null} canRun={is_owner && (status === 'submitted' || status === 'checked') && !ai} running={aiRunning} onRun={() => void runAiNow()} lastError={aiError} renderActions={renderActions} />
        </>}
        {is_owner && status === 'checked' && route_facts && <SendForApproval facts={route_facts} reviewers={reviewers.data as { id: string; name: string }[] | undefined} busy={busy} onSend={r => void send(r)} />}
        {canDecide && openApproval && <DecisionPanel approval={openApproval} busy={busy} onDecide={(d, cm) => void decide(d, cm)} />}
        <ApprovalHistory approvals={approvals as ApprovalRow[]} names={names} />
        {status !== 'draft' && <CommentsThread comments={comments} names={names} canComment busy={busy} onPost={post} />}
      </div>
    </div>}
    {editable && <div className="mt-6">{type === 'image' && file_url && <img src={file_url} alt={c.alt_text || ''} className="mb-4 max-h-72 rounded-md border" />}
      <ContentEditor key={c.version} workspaceId={ws.id} existing={{ id: c.id, version: c.version, type, file_name: c.file_name, fields: { title: c.title, channel: c.channel, audience: c.audience, goal: c.goal, body_text: c.body_text, alt_text: c.alt_text, text_color: c.text_color, background_color: c.background_color } }} onSaved={() => void refresh()} />
      {status === 'changes_requested' && <><ApprovalHistory approvals={approvals as ApprovalRow[]} names={names} /><CommentsThread comments={comments} names={names} canComment busy={busy} onPost={post} /></>}</div>}
    <Tabs defaultValue="versions" className="mt-8">
      <TabsList><TabsTrigger value="versions">Version history</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
      <TabsContent value="versions"><p className="text-sm text-muted-foreground">Every saved version is kept and cannot be changed.</p>
        <ol className="mt-4 divide-y rounded-lg border bg-card">{versions.map(v => <li key={v.id} className="flex flex-wrap items-center gap-3 p-4 text-sm"><span className="font-medium">v{v.version_number}</span><span className="text-muted-foreground">{v.change_summary} · {new Date(v.created_at).toLocaleString()}</span><span className="min-w-0 flex-1 truncate">{v.title}{v.file_name ? ` · ${v.file_name}` : ''}</span>{v.file_path && <Button size="sm" variant="ghost" onClick={() => void download(v.id)}><Download />File</Button>}</li>)}</ol></TabsContent>
      <TabsContent value="activity"><p className="mb-4 text-sm text-muted-foreground">Everything that happened to this content, newest first.</p>
        <ActivityTimeline events={buildActivity({ versions, actions: actions as ActionRow[], approvals: approvals as ApprovalRow[], comments, names, ownerId: c.owner_id, ownerName: owner_name, userId: user_id })} /></TabsContent>
    </Tabs>
    <AlertDialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm === 'submit' ? 'Submit this content?' : 'Delete this draft?'}</AlertDialogTitle><AlertDialogDescription>{confirm === 'submit' ? 'After submitting, you can no longer edit or delete it.' : 'The draft is removed from your list. Its saved versions are kept for the record.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={act}>{confirm === 'submit' ? 'Submit' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
