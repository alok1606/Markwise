import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Pencil, Plus, Trash2, History } from 'lucide-react';
import { toast } from 'sonner';
import type { ZodTypeAny } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteRecord, getHistory, saveRecord } from '@/lib/knowledge.functions';
import type { Entity } from '@/lib/knowledge';

export type Field = { name: string; label: string; type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'color' | 'list' | 'json'; options?: readonly string[]; hint?: string; required?: boolean };
type Row = { id: string };
const get = (row: Row | null | undefined, k: string) => (row as Record<string, unknown> | null | undefined)?.[k];
type HistoryItem = { id: string; version: number; change: string; summary: string; changed_at: string };
type Values = Record<string, string | boolean>;

const label = (s: string) => s.replace(/_/g, ' ');
function toForm(fields: Field[], row?: Row): Values {
  return Object.fromEntries(fields.map(f => {
    const v = get(row, f.name);
    if (f.type === 'checkbox') return [f.name, row ? Boolean(v) : f.name === 'active'];
    if (f.type === 'list') return [f.name, Array.isArray(v) ? v.join(', ') : ''];
    if (f.type === 'json') return [f.name, v && Object.keys(v as object).length ? JSON.stringify(v) : ''];
    if (f.type === 'select') return [f.name, (v as string) ?? f.options?.[0] ?? ''];
    return [f.name, (v as string) ?? ''];
  }));
}
function fromForm(fields: Field[], values: Values) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === 'list') out[f.name] = String(v).split(',').map(s => s.trim()).filter(Boolean);
    else if (f.type === 'json') { const s = String(v).trim(); if (!s) out[f.name] = {}; else { try { out[f.name] = JSON.parse(s); } catch { throw new Error(`${f.label} must be valid JSON, e.g. {"terms":["guaranteed"]}`); } } }
    else out[f.name] = v;
  }
  return out;
}

export function EntityManager<T extends Row>({ workspaceId, entity, title, description, rows, fields, schema, columns, renderRow, extraActions, emptyText, historyEnabled, layout = 'table', cardIdCell = 0, cardTitleCell = 1 }: {
  workspaceId: string; entity: Entity; title: string; description: string; rows: T[]; fields: Field[]; schema: ZodTypeAny;
  columns: string[]; renderRow: (row: T) => ReactNode[]; extraActions?: (row: T) => ReactNode; emptyText: string; historyEnabled?: boolean; layout?: 'table' | 'cards'; cardIdCell?: number; cardTitleCell?: number;
}) {
  const qc = useQueryClient(); const save = useServerFn(saveRecord); const remove = useServerFn(deleteRecord); const loadHistory = useServerFn(getHistory);
  const [editing, setEditing] = useState<Row | null | undefined>(undefined);
  const [values, setValues] = useState<Values>({}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [history, setHistory] = useState<{ row: Row; items: HistoryItem[] } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['knowledge', workspaceId] });
  function open(row: Row | null) { setEditing(row); setValues(toForm(fields, row ?? undefined)); setError(''); }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try {
      const parsed = schema.safeParse(fromForm(fields, values));
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the form'); return; }
      setBusy(true);
      await save({ data: { workspace_id: workspaceId, entity, id: editing?.id, values: parsed.data } });
      await refresh(); toast.success(editing ? 'Changes saved' : 'Added'); setEditing(undefined);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save'); } finally { setBusy(false); }
  }
  async function confirmDelete() {
    if (!deleting) return;
    try { await remove({ data: { workspace_id: workspaceId, entity, id: deleting.id } }); await refresh(); toast.success('Deleted'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to delete'); } finally { setDeleting(null); }
  }
  async function showHistory(row: Row) {
    try { setHistory({ row, items: await loadHistory({ data: { workspace_id: workspaceId, entity: entity as 'rules' | 'facts', id: row.id } }) }); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to load history'); }
  }
  const set = (name: string, v: string | boolean) => setValues(prev => ({ ...prev, [name]: v }));
  const addLabel = entity === 'facts' ? 'fact' : entity === 'glossary' ? 'term' : title.replace(/s$/, '');

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">Governance library</p><h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">{description}</p></div><Button onClick={() => open(null)} className="rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus />Add {addLabel}</Button></div>
    {rows.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-10 text-center"><div className="mx-auto grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Plus className="size-5" /></div><p className="mt-4 text-sm font-semibold text-slate-900">Nothing in this library yet</p><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600">{emptyText}</p><Button className="mt-5 rounded-lg bg-slate-900 text-white hover:bg-slate-800" onClick={() => open(null)}><Plus />Add first entry</Button></div> : layout === 'cards' ?
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between px-1 text-xs text-slate-500"><span>{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span><span>Managed by workspace admins</span></div>
        {rows.map(row => { const cells = renderRow(row); return <article key={row.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.035)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
          <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{cardIdCell >= 0 && <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">{cells[cardIdCell]}</span>}<div className="min-w-[180px] flex-1">{cells[cardTitleCell]}</div></div>
              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">{cells.map((cell, i) => i === cardIdCell || i === cardTitleCell ? null : <div key={i} className="min-w-0"><p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">{columns[i]}</p><div className="text-sm text-slate-700">{cell}</div></div>)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-50 p-1">{extraActions?.(row)}{historyEnabled && <Button variant="ghost" size="icon" aria-label={`Version history for ${String(get(row, 'code') ?? '')}`} onClick={() => showHistory(row)} className="size-8 text-slate-500 hover:bg-white hover:text-slate-900"><History className="size-4" /></Button>}<Button variant="ghost" size="icon" aria-label={`Edit ${String(get(row, 'title') ?? title)}`} onClick={() => open(row)} className="size-8 text-slate-500 hover:bg-white hover:text-slate-900"><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${String(get(row, 'title') ?? title)}`} onClick={() => setDeleting(row)} className="size-8 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></Button></div>
          </div>
        </article>; })}
      </div> : <div className="mt-6 overflow-x-auto rounded-lg border bg-card"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-muted-foreground"><tr>{columns.map(c => <th key={c} className="px-4 py-3 font-medium">{c}</th>)}<th className="px-4 py-3 text-right font-medium">Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b last:border-0 align-top">{renderRow(row).map((cell, i) => <td key={i} className="px-4 py-4">{cell}</td>)}<td className="px-4 py-3"><div className="flex justify-end gap-1">{extraActions?.(row)}{historyEnabled && <Button variant="ghost" size="icon" aria-label={`Version history for ${String(get(row, 'code') ?? '')}`} onClick={() => showHistory(row)}><History /></Button>}<Button variant="ghost" size="icon" aria-label="Edit" onClick={() => open(row)}><Pencil /></Button><Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeleting(row)}><Trash2 /></Button></div></td></tr>)}</tbody></table></div>}

    <Dialog open={editing !== undefined} onOpenChange={o => !o && setEditing(undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editing ? `Edit ${title.toLowerCase()}` : `Add to ${title.toLowerCase()}`}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <form id={`${entity}-form`} onSubmit={submit} className="space-y-4">{fields.map(f => <div key={f.name} className="space-y-1.5">
          {f.type === 'checkbox' ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(values[f.name])} onChange={e => set(f.name, e.target.checked)} className="size-4 accent-primary" />{f.label}</label> : <>
            <Label htmlFor={`${entity}-${f.name}`}>{f.label}{f.required && ' *'}</Label>
            {f.type === 'textarea' ? <Textarea id={`${entity}-${f.name}`} value={String(values[f.name] ?? '')} onChange={e => set(f.name, e.target.value)} rows={3} />
              : f.type === 'select' ? <select id={`${entity}-${f.name}`} className="h-9 w-full rounded-md border bg-card px-3 text-sm capitalize" value={String(values[f.name])} onChange={e => set(f.name, e.target.value)}>{f.options?.map(o => <option key={o} value={o}>{label(o)}</option>)}</select>
              : f.type === 'color' ? <div className="flex gap-2"><input type="color" aria-label={`${f.label} picker`} value={/^#[0-9A-Fa-f]{6}$/.test(String(values[f.name])) ? String(values[f.name]) : '#000000'} onChange={e => set(f.name, e.target.value.toUpperCase())} className="h-9 w-12 rounded border bg-card" /><Input id={`${entity}-${f.name}`} value={String(values[f.name] ?? '')} onChange={e => set(f.name, e.target.value)} placeholder="#1F2A44" /></div>
              : <Input id={`${entity}-${f.name}`} type={f.type === 'date' ? 'date' : 'text'} value={String(values[f.name] ?? '')} onChange={e => set(f.name, e.target.value)} required={f.required} />}
            {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}</>}
        </div>)}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form>
        <DialogFooter><Button variant="outline" onClick={() => setEditing(undefined)}>Cancel</Button><Button type="submit" form={`${entity}-form`} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this entry?</AlertDialogTitle><AlertDialogDescription>{historyEnabled ? 'Its final version is kept in version history.' : 'This cannot be undone.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

    <Dialog open={!!history} onOpenChange={o => !o && setHistory(null)}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Version history · {String(get(history?.row, 'code') ?? '')}</DialogTitle><DialogDescription>Current version {String(get(history?.row, 'version') ?? '')}. Earlier versions are preserved and cannot be edited.</DialogDescription></DialogHeader>
      {history?.items.length ? <ol className="space-y-3">{history.items.map(h => <li key={h.id} className="rounded-md border p-3 text-sm"><p className="font-medium">Version {h.version} · <span className="capitalize">{h.change === 'updated' ? 'replaced' : h.change}</span></p><p className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString()}</p><p className="mt-2 text-muted-foreground">{h.summary}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">No earlier versions yet.</p>}
    </DialogContent></Dialog>
  </section>;
}
