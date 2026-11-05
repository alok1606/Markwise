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
import { canCreateContent, canViewWorkspaceContent, isEditable, type ContentStatus, type ContentType } from '@/lib/content';
import { contentOptions } from '@/lib/content-queries';
import { deleteContentDraft, getVersionFileUrl, submitContent } from '@/lib/content.functions';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/content/$id')({ head: () => meta('Content', 'Content details and version history.'), component: ContentDetail });

function ContentDetail() {
  const { id } = Route.useParams(); const ws = useWorkspace(); const qc = useQueryClient(); const navigate = useNavigate();
  const allowed = canCreateContent(ws.role) || canViewWorkspaceContent(ws.role);
  const q = useQuery({ ...contentOptions(ws.id, id), enabled: !!ws.id && allowed, retry: false });
  const submit = useServerFn(submitContent); const remove = useServerFn(deleteContentDraft); const versionUrl = useServerFn(getVersionFileUrl);
  const [confirm, setConfirm] = useState<'submit' | 'delete' | null>(null);
  if (!allowed) return <AccessRequired message="Your role in this workspace has no access to content." />;
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <><h1 className="text-2xl font-semibold">Content not available</h1><p className="mt-3 text-muted-foreground">It may not exist, or you may not have access in this workspace.</p></>;
  const { content: c, versions, file_url, owner_name, is_owner } = q.data;
  const status = c.status as ContentStatus; const type = c.type as ContentType; const editable = is_owner && isEditable(status);
  const refresh = () => qc.invalidateQueries({ queryKey: ['content'] });
  async function act() {
    try {
      if (confirm === 'submit') { await submit({ data: { workspace_id: ws.id, id, expected_version: c.version } }); toast.success('Content submitted'); await refresh(); }
      if (confirm === 'delete') { await remove({ data: { workspace_id: ws.id, id } }); toast.success('Draft deleted'); await refresh(); await navigate({ to: '/content' }); }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Action failed'); await refresh(); } finally { setConfirm(null); }
  }
  async function download(versionId: string) {
    try { const { url } = await versionUrl({ data: { workspace_id: ws.id, id, version_id: versionId } }); window.location.assign(url); } catch (err) { toast.error(err instanceof Error ? err.message : 'Download failed'); }
  }
  return <>
    <Link to={is_owner ? '/content' : '/content/all'} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><TypeIcon type={type} /><span className="text-xs uppercase text-muted-foreground">{type} · v{c.version}</span><StatusBadge status={status} /></div><h1 className="mt-2 text-3xl font-semibold">{c.title}</h1><p className="mt-1 text-sm text-muted-foreground">By {owner_name}{c.submitted_at ? ` · submitted ${new Date(c.submitted_at).toLocaleString()}` : ''}</p></div>
      {editable && <div className="flex gap-2"><Button variant="outline" onClick={() => setConfirm('delete')}><Trash2 />Delete draft</Button><Button onClick={() => setConfirm('submit')}><Send />Submit</Button></div>}</div>
    {!editable && <section className="mt-6 space-y-4 rounded-lg border bg-card p-6">
      <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">Channel</dt><dd>{c.channel || '—'}</dd></div><div><dt className="text-muted-foreground">Audience</dt><dd>{c.audience || '—'}</dd></div><div><dt className="text-muted-foreground">Goal</dt><dd>{c.goal || '—'}</dd></div></dl>
      {type === 'image' && file_url && <img src={file_url} alt={c.alt_text || ''} className="max-h-96 rounded-md border" />}
      {type === 'image' && <p className="text-sm"><span className="text-muted-foreground">Alt text: </span>{c.alt_text || <em>empty</em>}{c.text_color ? ` · text ${c.text_color}` : ''}{c.background_color ? ` · background ${c.background_color}` : ''}</p>}
      {type !== 'image' && <p className="whitespace-pre-wrap text-sm">{c.body_text || 'No text.'}</p>}
      {is_owner && <p className="text-xs text-muted-foreground">Submitted content is locked and cannot be edited or deleted.</p>}
    </section>}
    {editable && <div className="mt-6">{type === 'image' && file_url && <img src={file_url} alt={c.alt_text || ''} className="mb-4 max-h-72 rounded-md border" />}
      <ContentEditor key={c.version} workspaceId={ws.id} existing={{ id: c.id, version: c.version, type, file_name: c.file_name, fields: { title: c.title, channel: c.channel, audience: c.audience, goal: c.goal, body_text: c.body_text, alt_text: c.alt_text, text_color: c.text_color, background_color: c.background_color } }} onSaved={() => void refresh()} /></div>}
    <section className="mt-8"><h2 className="text-lg font-semibold">Version history</h2><p className="text-sm text-muted-foreground">Every saved version is kept and cannot be changed.</p>
      <ol className="mt-4 divide-y rounded-lg border bg-card">{versions.map(v => <li key={v.id} className="flex flex-wrap items-center gap-3 p-4 text-sm"><span className="font-medium">v{v.version_number}</span><span className="text-muted-foreground">{v.change_summary} · {new Date(v.created_at).toLocaleString()}</span><span className="min-w-0 flex-1 truncate">{v.title}{v.file_name ? ` · ${v.file_name}` : ''}</span>{v.file_path && <Button size="sm" variant="ghost" onClick={() => void download(v.id)}><Download />File</Button>}</li>)}</ol></section>
    <AlertDialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm === 'submit' ? 'Submit this content?' : 'Delete this draft?'}</AlertDialogTitle><AlertDialogDescription>{confirm === 'submit' ? 'After submitting, you can no longer edit or delete it.' : 'The draft is removed from your list. Its saved versions are kept for the record.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={act}>{confirm === 'submit' ? 'Submit' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
