import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { CloudUpload, Download, FileText, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react';
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
    {kind === 'document' ? <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">Workspace reference library</p><h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">Keep the source documents admins use to maintain consistent brand standards.</p></div><div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">{rows.length} {rows.length === 1 ? 'document' : 'documents'}</div></header>
      <div className="my-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 sm:p-6"><div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><CloudUpload className="size-5" /></div><div><p className="font-semibold text-slate-900">Add a guideline document</p><p className="mt-1 max-w-xl text-sm leading-5 text-slate-600">Upload a reference your team can keep alongside its rules and approved facts.</p><p className="mt-2 text-xs text-slate-500">{rule.label}</p></div></div><Button onClick={() => pick(null)} disabled={busy} className="rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Upload />{busy ? 'Uploading…' : 'Choose a file'}</Button></div>
        <aside className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-4"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-teal-700 shadow-sm"><ShieldCheck className="size-4" /></div><div><p className="text-sm font-semibold text-teal-950">Private workspace files</p><p className="mt-1 text-xs leading-5 text-teal-900/80">Only workspace administrators can access these documents.</p></div></aside>
      </div>
    </> : <header className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-200 pt-7"><div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">Approved library · {rows.length} {rows.length === 1 ? 'asset' : 'assets'}</p><h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2><p className="mt-1.5 text-sm text-slate-600">{description} {rule.label}.</p></div>
      <div className="flex flex-wrap items-end gap-3"><div className="space-y-1.5"><Label htmlFor="asset-category" className="text-xs text-slate-600">Asset category</Label><select id="asset-category" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm capitalize text-slate-800" value={category} onChange={e => setCategory(e.target.value as typeof category)}>{assetCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <Button onClick={() => pick(null)} disabled={busy} className="h-10 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Upload />{busy ? 'Uploading…' : 'Upload asset'}</Button></div></header>}
    <Input ref={input} type="file" className="hidden" aria-label={`Upload ${title.toLowerCase()}`} accept={Object.keys(rule.types).join(',') + (kind === 'document' ? ',.md' : '')} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
    {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
    {rows.length === 0 ? kind === 'document' ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center"><div className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><FileText className="size-5" /></div><p className="mt-3 text-sm font-semibold text-slate-900">No guideline documents yet</p><p className="mt-1 text-sm text-slate-600">Add a trusted source document to this workspace library.</p><Button variant="outline" className="mt-4 rounded-lg border-slate-300 bg-white" disabled={busy} onClick={() => pick(null)}><Upload />Choose a file</Button></div> : <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center"><div className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><FileText className="size-5" /></div><p className="mt-3 text-sm font-semibold text-slate-900">No brand assets yet</p><p className="mt-1 text-sm text-slate-600">Upload an approved logo, image, or icon to start your visual library.</p><Button variant="outline" className="mt-4 rounded-lg border-slate-300 bg-white" disabled={busy} onClick={() => pick(null)}><Upload />Upload first asset</Button></div> :
      kind === 'document' ? <ul className="space-y-2">{rows.map(row => <li key={row.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:px-5"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileText className="size-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900" title={row.name}>{row.name}</p><p className="mt-1 text-xs text-slate-500">{new Date(row.created_at).toLocaleDateString()}{row.updated_at !== row.created_at ? ` · updated ${new Date(row.updated_at).toLocaleDateString()}` : ''}<span className="mx-1.5 text-slate-300">·</span>{size(row.size_bytes)}<span className="mx-1.5 text-slate-300">·</span>{row.name.split('.').pop()?.toUpperCase()}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${row.status === 'replaced' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{row.status === 'replaced' ? 'Replaced' : 'Stored securely'}</span><Actions row={row} /></div></li>)}</ul>
      : <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map(row => <li key={row.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"><div className="relative flex h-44 items-center justify-center overflow-hidden bg-slate-50 p-4">{row.preview_url ? <img src={row.preview_url} alt={row.name} className="max-h-full max-w-full object-contain" /> : <div className="grid size-12 place-items-center rounded-xl bg-white text-slate-400 shadow-sm"><FileText className="size-6" /></div>}<span className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-semibold capitalize text-slate-600 shadow-sm">{row.category || 'Asset'}</span></div>
          <div className="flex items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900" title={row.name}>{row.name}</p><p className="mt-1 text-xs text-slate-500">{size(row.size_bytes)} <span className="mx-1 text-slate-300">·</span> Updated {new Date(row.updated_at).toLocaleDateString()}</p></div><Actions row={row} /></div></li>)}</ul>}
    <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>The file is removed from secure storage. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;

  function Actions({ row }: { row: FileRow }) {
    const actionClass = kind === 'document' ? 'size-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900' : '';
    return <div className={`${kind === 'asset' ? 'mt-2' : ''} flex gap-1`}><Button variant="ghost" size="icon" className={actionClass} aria-label={`Download ${row.name}`} onClick={() => download(row)}><Download /></Button><Button variant="ghost" size="icon" className={actionClass} aria-label={`Replace ${row.name}`} disabled={busy} onClick={() => pick(row)}><RefreshCw /></Button><Button variant="ghost" size="icon" className={actionClass} aria-label={`Delete ${row.name}`} onClick={() => setDeleting(row)}><Trash2 /></Button></div>;
  }
}
