import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Download, FileText, RefreshCw, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { deleteRecord, getFileUrl, registerFile } from '@/lib/knowledge.functions';
import { assetCategories, fileRules, fileType, validateUpload, type FileKind } from '@/lib/knowledge';

type FileRow = { id: string; name: string; mime_type: string; size_bytes: number; created_at: string; updated_at: string; status?: string; category?: string; preview_url?: string | null };
const size = (b: number) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export function FileManager({ workspaceId, kind, rows, title, description }: { workspaceId: string; kind: FileKind; rows: FileRow[]; title: string; description: string }) {
  const rule = fileRules[kind]; const qc = useQueryClient();
  const register = useServerFn(registerFile); const remove = useServerFn(deleteRecord); const fileUrl = useServerFn(getFileUrl);
  const input = useRef<HTMLInputElement>(null); const replaceTarget = useRef<FileRow | null>(null);
  const [category, setCategory] = useState<(typeof assetCategories)[number]>('logo');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [deleting, setDeleting] = useState<FileRow | null>(null);

  async function upload(file: File) {
    setError('');
    const problem = validateUpload(kind, file); if (problem) { setError(problem); return; }
    const type = fileType(file.name, file.type);
    const path = `${workspaceId}/${crypto.randomUUID()}.${rule.types[type]}`;
    setBusy(true);
    try {
      const { error: upErr } = await supabase.storage.from(rule.bucket).upload(path, file, { contentType: type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      const target = replaceTarget.current;
      await register({ data: { workspace_id: workspaceId, kind, path, name: target ? target.name : file.name.slice(0, 200), replace_id: target?.id, category: kind === 'asset' ? (target?.category as typeof category | undefined) ?? category : undefined } });
      await qc.invalidateQueries({ queryKey: ['knowledge', workspaceId] }); toast.success(target ? 'File replaced' : 'File uploaded');
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); } finally { setBusy(false); replaceTarget.current = null; if (input.current) input.current.value = ''; }
  }
  async function download(row: FileRow) {
    try { const { url } = await fileUrl({ data: { workspace_id: workspaceId, kind, id: row.id } }); window.location.assign(url); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Download failed'); }
  }
  async function confirmDelete() {
    if (!deleting) return;
    try { await remove({ data: { workspace_id: workspaceId, entity: kind, id: deleting.id } }); await qc.invalidateQueries({ queryKey: ['knowledge', workspaceId] }); toast.success('File deleted'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to delete'); } finally { setDeleting(null); }
  }
  const pick = (target: FileRow | null) => { replaceTarget.current = target; input.current?.click(); };

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description} {rule.label}.</p></div>
      <div className="flex items-end gap-3">{kind === 'asset' && <div className="space-y-1.5"><Label htmlFor="asset-category">Category</Label><select id="asset-category" className="h-9 rounded-md border bg-card px-3 text-sm capitalize" value={category} onChange={e => setCategory(e.target.value as typeof category)}>{assetCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>}
        <Button onClick={() => pick(null)} disabled={busy}><Upload />{busy ? 'Uploading…' : 'Upload'}</Button></div></div>
    <Input ref={input} type="file" className="hidden" aria-label={`Upload ${title.toLowerCase()}`} accept={Object.keys(rule.types).join(',') + (kind === 'document' ? ',.md' : '')} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {rows.length === 0 ? <div className="mt-6 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No files yet. Upload your first {kind === 'document' ? 'guideline document' : 'logo or approved image'}.</div> :
      <ul className={kind === 'asset' ? 'mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'mt-6 divide-y rounded-lg border bg-card'}>{rows.map(row => kind === 'asset'
        ? <li key={row.id} className="overflow-hidden rounded-lg border bg-card"><div className="flex h-36 items-center justify-center bg-muted">{row.preview_url ? <img src={row.preview_url} alt={row.name} className="max-h-full max-w-full object-contain" /> : <FileText className="size-8 text-muted-foreground" />}</div>
          <div className="p-4"><p className="truncate text-sm font-medium">{row.name}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{row.category} · {size(row.size_bytes)}</p><Actions row={row} /></div></li>
        : <li key={row.id} className="flex flex-wrap items-center gap-4 p-4"><FileText className="size-5 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{row.name}</p><p className="mt-1 text-xs text-muted-foreground">Uploaded {new Date(row.created_at).toLocaleDateString()}{row.updated_at !== row.created_at ? ` · updated ${new Date(row.updated_at).toLocaleDateString()}` : ''} · {size(row.size_bytes)} · <span className="text-primary">Stored securely</span></p></div><Actions row={row} /></li>)}</ul>}
    <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>The file is removed from secure storage. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;

  function Actions({ row }: { row: FileRow }) {
    return <div className="mt-2 flex gap-1"><Button variant="ghost" size="icon" aria-label={`Download ${row.name}`} onClick={() => download(row)}><Download /></Button><Button variant="ghost" size="icon" aria-label={`Replace ${row.name}`} disabled={busy} onClick={() => pick(row)}><RefreshCw /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${row.name}`} onClick={() => setDeleting(row)}><Trash2 /></Button></div>;
  }
}
