import { CheckCircle2, FileText, MessageSquare, Send, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ActivityEvent, ActivityKind } from '@/lib/activity';

const KIND: Record<ActivityKind, { label: string; Icon: typeof FileText }> = {
  version: { label: 'Version', Icon: FileText }, finding_action: { label: 'Finding action', Icon: Wrench },
  sent: { label: 'Approval', Icon: Send }, decision: { label: 'Decision', Icon: CheckCircle2 }, comment: { label: 'Comment', Icon: MessageSquare },
};
const TONE: Record<ActivityEvent['tone'], string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  bad: 'border-rose-200 bg-rose-50 text-rose-800',
};

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (!events.length) return <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No activity yet. Saved versions, finding actions, approval decisions and comments for this content will appear here.</p>;
  return <ol className="relative ml-3 space-y-4 border-l pl-6" aria-label="Content activity, newest first">
    {events.map(e => { const { label, Icon } = KIND[e.kind]; return <li key={e.key} className="relative">
      <span className={`absolute -left-[33px] flex size-6 items-center justify-center rounded-full border bg-background ${TONE[e.tone]}`}><Icon className="size-3.5" aria-hidden /></span>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="outline" className={TONE[e.tone]}>{label}</Badge><span className="font-medium">{e.title}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{e.actor} · <time dateTime={e.at}>{new Date(e.at).toLocaleString()}</time></p>
        {e.detail && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{e.detail}</p>}
      </div></li>; })}
  </ol>;
}
