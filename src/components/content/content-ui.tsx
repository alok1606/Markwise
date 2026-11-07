import { Link } from '@tanstack/react-router';
import { FileText, ImageIcon, LockKeyhole, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { statusLabel, type ContentStatus, type ContentType } from '@/lib/content';

export function AccessRequired({ message }: { message: string }) {
  return <><LockKeyhole className="size-8 text-primary" /><h1 className="mt-5 text-2xl font-semibold">Access required</h1><p className="mt-3 text-muted-foreground">{message}</p></>;
}
export function StatusBadge({ status }: { status: ContentStatus }) {
  const tone: Record<ContentStatus, string> = {
    draft: 'border-slate-200 bg-slate-50 text-slate-700',
    submitted: 'border-blue-200 bg-blue-50 text-blue-800',
    checked: 'border-teal-200 bg-teal-50 text-teal-800',
    pending_manager: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    pending_reviewer: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    in_review: 'border-sky-200 bg-sky-50 text-sky-800',
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rejected: 'border-rose-200 bg-rose-50 text-rose-800',
    changes_requested: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  return <Badge variant="outline" className={tone[status]}>{statusLabel[status]}</Badge>;
}
export const TypeIcon = ({ type }: { type: ContentType }) => type === 'text' ? <Type className="size-4 text-primary" /> : type === 'image' ? <ImageIcon className="size-4 text-primary" /> : <FileText className="size-4 text-primary" />;

type Row = { id: string; title: string; type: ContentType; channel: string; status: ContentStatus; version: number; updated_at: string; owner_name?: string; finding_count?: number | null };
export function ContentList({ rows, empty }: { rows: Row[]; empty: React.ReactNode }) {
  if (!rows.length) return <div className="mt-6 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{empty}</div>;
  return <ul className="mt-6 divide-y rounded-lg border bg-card">{rows.map(r => <li key={r.id}><Link to="/content/$id" params={{ id: r.id }} className="flex flex-wrap items-center gap-4 p-4 hover:bg-muted">
    <TypeIcon type={r.type} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.title}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{r.type} · {r.channel || 'No channel'} · v{r.version}{r.owner_name ? ` · ${r.owner_name}` : ''} · updated {new Date(r.updated_at).toLocaleDateString()}</p></div>{r.finding_count != null && <Badge variant="outline">{r.finding_count} {r.finding_count === 1 ? 'finding' : 'findings'}</Badge>}<StatusBadge status={r.status} /></Link></li>)}</ul>;
}
