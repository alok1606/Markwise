import { useState } from 'react';
import { CheckCircle2, MessageSquare, PencilLine, Route as RouteIcon, ShieldAlert, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { decisionError, diffWords, dismissalError, threadComments, type Decision } from '@/lib/approval';

export type ActionRow = { id: string; finding_id: string; action: string; reason: string | null; final_text: string | null; actor_id: string; created_at: string };
export type ApprovalRow = { id: string; version_number: number; route: string; reviewer_id: string | null; assigned_by: string; ai_state_at_routing: string; status: string; decision_comment: string | null; decided_by: string | null; decided_at: string | null; created_at: string };
export type CommentRow = { id: string; parent_id: string | null; author_id: string; message: string; created_at: string };
type F = { id: string; quoted_text: string; suggested_text?: string | null; span_start: number | null };

const actionLabel: Record<string, string> = { accepted: 'Suggestion accepted', edited: 'Edited rewrite applied', dismissed: 'Dismissed' };

/** Resolution state and buttons for one finding. */
export function FindingResolution({ f, action, names, canAct, canRewrite, busy, onAct }: { f: F; action?: ActionRow | undefined; names: Record<string, string>; canAct: boolean; canRewrite: boolean; busy: boolean; onAct: (a: 'accepted' | 'edited' | 'dismissed', opts: { reason?: string; final_text?: string }) => Promise<boolean> }) {
  const [mode, setMode] = useState<'accept' | 'edit' | 'dismiss' | null>(null);
  const [text, setText] = useState(''); const [err, setErr] = useState<string | null>(null);
  if (action) return <p className="mt-2 rounded-md bg-muted p-2 text-xs"><span className="font-medium">{actionLabel[action.action] ?? action.action}</span> by {names[action.actor_id] ?? 'Creator'} · {new Date(action.created_at).toLocaleString()}
    {action.reason && <><br /><span className="text-muted-foreground">Reason: </span>{action.reason}</>}{action.final_text !== null && action.action !== 'dismissed' && <><br /><span className="text-muted-foreground">Final text: </span>“{action.final_text}”</>}</p>;
  if (!canAct) return null;
  const hasSuggestion = canRewrite && f.suggested_text != null;
  const proposed = mode === 'accept' ? f.suggested_text ?? '' : text;
  async function confirm() {
    if (mode === 'dismiss') { const e = dismissalError(text); if (e) return setErr(e); if (await onAct('dismissed', { reason: text })) setMode(null); return; }
    if (mode === 'edit' && !text.trim() && text !== '') return setErr('Enter the replacement text.');
    if (await onAct(mode === 'accept' ? 'accepted' : 'edited', { final_text: proposed })) setMode(null);
  }
  return <>
    <div className="mt-2 flex flex-wrap gap-2">
      {hasSuggestion && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMode('accept'); setErr(null); }}><CheckCircle2 />Accept</Button>}
      {canRewrite && f.span_start !== null && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMode('edit'); setText(f.suggested_text ?? f.quoted_text); setErr(null); }}><PencilLine />Edit</Button>}
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setMode('dismiss'); setText(''); setErr(null); }}><XCircle />Dismiss</Button>
    </div>
    <Dialog open={!!mode} onOpenChange={o => !o && setMode(null)}><DialogContent>
      <DialogHeader><DialogTitle>{mode === 'dismiss' ? 'Dismiss this finding' : mode === 'accept' ? 'Accept the suggested rewrite' : 'Edit the rewrite'}</DialogTitle>
        <DialogDescription>{mode === 'dismiss' ? 'The finding stays on record with your reason, and approvers will see it.' : 'A new version is saved (the current one is kept) and checked again automatically.'}</DialogDescription></DialogHeader>
      {mode === 'dismiss' && <div className="space-y-1.5"><Label htmlFor="dismiss-reason">Reason (required)</Label><Textarea id="dismiss-reason" value={text} onChange={e => setText(e.target.value)} maxLength={1000} /></div>}
      {mode === 'edit' && <div className="space-y-1.5"><Label htmlFor="edit-text">Replacement for “{f.quoted_text}”</Label><Textarea id="edit-text" value={text} onChange={e => setText(e.target.value)} maxLength={2000} /></div>}
      {mode !== 'dismiss' && <div className="rounded-md border p-3 text-sm" aria-label="Changes"><p className="mb-1 text-xs text-muted-foreground">Original → proposed</p>
        {diffWords(f.quoted_text, proposed).map((p, i) => p.kind === 'same' ? <span key={i}>{p.text}</span> : p.kind === 'removed' ? <del key={i} className="bg-destructive/15 text-destructive">{p.text}</del> : <ins key={i} className="bg-primary/15 text-primary no-underline">{p.text}</ins>)}</div>}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <DialogFooter><Button variant="outline" onClick={() => setMode(null)}>Cancel</Button><Button disabled={busy} onClick={() => void confirm()}>{busy ? 'Saving…' : mode === 'dismiss' ? 'Dismiss finding' : 'Save new version'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}

export type RouteFacts = { version: number; status: string; ai_state: 'completed' | 'failed' | 'pending'; blocking: number; route: 'manager' | 'reviewer' };

export function SendForApproval({ facts, reviewers, busy, onSend }: { facts: RouteFacts; reviewers: { id: string; name: string }[] | undefined; busy: boolean; onSend: (reviewerId: string | null) => void }) {
  const [reviewer, setReviewer] = useState('');
  const blocked = facts.ai_state === 'pending' || facts.blocking > 0 || (facts.route === 'reviewer' && !reviewer);
  return <section className="mt-6 rounded-lg border bg-card p-6" aria-labelledby="send-h">
    <h2 id="send-h" className="flex items-center gap-2 text-lg font-semibold"><RouteIcon className="size-4 text-primary" />Send for approval</h2>
    <p className="mt-1 text-sm text-muted-foreground">{facts.route === 'reviewer' ? 'This version has claim, legal or “needs checking” findings, so a named reviewer must approve it.' : 'No claim or legal findings: this goes to a manager for approval.'}</p>
    {facts.ai_state === 'pending' && <p role="status" className="mt-3 rounded-md border border-dashed p-3 text-sm">The AI review has not finished for this version. Wait for it, or run it again from the AI review section.</p>}
    {facts.ai_state === 'failed' && <p role="status" className="mt-3 flex gap-2 rounded-md border border-destructive/40 p-3 text-sm"><ShieldAlert className="size-4 shrink-0 text-destructive" />AI review failed for this version. You can still send it; routing will use the automatic checks only, and approvers will see this warning.</p>}
    {facts.blocking > 0 && <p role="status" className="mt-3 text-sm text-destructive">Resolve {facts.blocking} high or critical finding{facts.blocking === 1 ? '' : 's'} first (accept, edit or dismiss with a reason).</p>}
    {facts.route === 'reviewer' && <div className="mt-4 max-w-sm space-y-1.5"><Label htmlFor="reviewer">Reviewer</Label>
      <select id="reviewer" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={reviewer} onChange={e => setReviewer(e.target.value)}><option value="">Choose a reviewer…</option>{(reviewers ?? []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      {reviewers && !reviewers.length && <p className="text-xs text-destructive">No reviewers in this workspace yet. Ask an administrator to add one.</p>}</div>}
    <Button className="mt-4" disabled={blocked || busy} onClick={() => onSend(facts.route === 'reviewer' ? reviewer : null)}>{busy ? 'Sending…' : 'Send for approval'}</Button>
  </section>;
}

export function DecisionPanel({ approval, busy, onDecide }: { approval: ApprovalRow; busy: boolean; onDecide: (d: Decision, comment: string) => void }) {
  const [comment, setComment] = useState(''); const [err, setErr] = useState<string | null>(null);
  const route = approval.route as 'manager' | 'reviewer';
  const go = (d: Decision) => { const e = decisionError(route, d, comment); if (e) return setErr(e); setErr(null); onDecide(d, comment); };
  return <section className="mt-6 rounded-lg border-2 border-primary/40 bg-card p-6" aria-labelledby="decide-h">
    <h2 id="decide-h" className="text-lg font-semibold">Your decision</h2>
    <p className="mt-1 text-sm text-muted-foreground">Deciding version {approval.version_number}. {route === 'reviewer' ? 'A comment is required.' : 'A comment is required to request changes or reject.'}</p>
    {approval.ai_state_at_routing === 'failed' && <p className="mt-3 flex gap-2 rounded-md border border-destructive/40 p-3 text-sm"><ShieldAlert className="size-4 shrink-0 text-destructive" />The AI review failed for this version; it was routed on automatic checks only.</p>}
    <div className="mt-4 space-y-1.5"><Label htmlFor="decision-comment">Comment</Label><Textarea id="decision-comment" value={comment} onChange={e => setComment(e.target.value)} maxLength={4000} /></div>
    {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
    <div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} onClick={() => go('approved')}><CheckCircle2 />Approve</Button><Button variant="outline" disabled={busy} onClick={() => go('changes_requested')}>Request changes</Button><Button variant="destructive" disabled={busy} onClick={() => go('rejected')}><XCircle />Reject</Button></div>
  </section>;
}

const decisionText: Record<string, string> = { open: 'Awaiting decision', approved: 'Approved', changes_requested: 'Changes requested', rejected: 'Rejected' };
export function ApprovalHistory({ approvals, names }: { approvals: ApprovalRow[]; names: Record<string, string> }) {
  if (!approvals.length) return null;
  return <section className="mt-6 rounded-lg border bg-card p-6"><h2 className="text-lg font-semibold">Approval history</h2><p className="text-sm text-muted-foreground">Every cycle and decision is kept and cannot be changed.</p>
    <ol className="mt-4 space-y-3">{approvals.map(a => <li key={a.id} className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">Version {a.version_number}</span><Badge variant={a.status === 'approved' ? 'default' : a.status === 'rejected' ? 'destructive' : 'secondary'}>{decisionText[a.status]}</Badge>
        <span className="text-muted-foreground">{a.route === 'reviewer' ? `Reviewer: ${names[a.reviewer_id ?? ''] ?? 'Reviewer'}` : 'Manager route'} · sent {new Date(a.created_at).toLocaleString()}</span>
        {a.ai_state_at_routing === 'failed' && <Badge variant="outline">AI review failed</Badge>}</div>
      {a.decided_at && <p className="mt-1">{names[a.decided_by ?? ''] ?? 'Approver'} · {new Date(a.decided_at).toLocaleString()}{a.decision_comment ? <>: “{a.decision_comment}”</> : ''}</p>}
    </li>)}</ol></section>;
}

export function CommentsThread({ comments, names, canComment, busy, onPost }: { comments: CommentRow[]; names: Record<string, string>; canComment: boolean; busy: boolean; onPost: (message: string, parentId: string | null) => Promise<boolean> }) {
  const [text, setText] = useState(''); const [replyTo, setReplyTo] = useState<string | null>(null); const [reply, setReply] = useState('');
  const tree = threadComments(comments);
  const render = (nodes: ReturnType<typeof threadComments<CommentRow>>, depth: number): React.ReactNode => <ul className={depth ? 'ml-6 mt-2 space-y-2 border-l pl-4' : 'mt-4 space-y-3'}>{nodes.map(n => <li key={n.id} className="text-sm">
    <p><span className="font-medium">{names[n.author_id] ?? 'Member'}</span> <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span></p>
    <p className="whitespace-pre-wrap">{n.message}</p>
    {canComment && <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => { setReplyTo(n.id); setReply(''); }}>Reply</Button>}
    {replyTo === n.id && <div className="mt-2 space-y-2"><Label htmlFor={`reply-${n.id}`} className="sr-only">Reply</Label><Textarea id={`reply-${n.id}`} value={reply} onChange={e => setReply(e.target.value)} maxLength={4000} />
      <div className="flex gap-2"><Button size="sm" disabled={busy || !reply.trim()} onClick={() => void onPost(reply, n.id).then(ok => ok && setReplyTo(null))}>Post reply</Button><Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>Cancel</Button></div></div>}
    {n.replies.length > 0 && render(n.replies, depth + 1)}</li>)}</ul>;
  return <section className="mt-6 rounded-lg border bg-card p-6" aria-labelledby="comments-h"><h2 id="comments-h" className="flex items-center gap-2 text-lg font-semibold"><MessageSquare className="size-4 text-primary" />Comments</h2>
    {!comments.length && <p className="mt-2 text-sm text-muted-foreground">No comments yet.</p>}
    {render(tree, 0)}
    {canComment && <div className="mt-4 space-y-2"><Label htmlFor="new-comment">Add a comment</Label><Textarea id="new-comment" value={text} onChange={e => setText(e.target.value)} maxLength={4000} />
      <Button size="sm" disabled={busy || !text.trim()} onClick={() => void onPost(text, null).then(ok => ok && setText(''))}>Post comment</Button></div>}
  </section>;
}
