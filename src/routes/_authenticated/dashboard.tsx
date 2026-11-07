import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FilePlus2,
  Files,
  Layers3,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/components/app-shell';
import { StatusBadge, TypeIcon } from '@/components/content/content-ui';
import { accessOptions } from '@/lib/queries';
import { myContentOptions, reviewQueueOptions, workspaceContentOptions } from '@/lib/content-queries';
import { type ContentStatus, type ContentType } from '@/lib/content';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/dashboard')({
  head: () => meta('Workspace overview', 'Your secure Markwise workspace and account overview.'),
  component: Dashboard,
});

type DashboardItem = {
  id: string;
  title: string;
  type: ContentType;
  channel: string;
  status: ContentStatus;
  version: number;
  updatedAt: string;
  ownerName?: string;
  approvalStatus?: string;
};

function Dashboard() {
  const { data } = useSuspenseQuery(accessOptions);
  const workspace = useWorkspace();
  const creatorQuery = useQuery({ ...myContentOptions(workspace.id), enabled: Boolean(workspace.id) && workspace.role === 'creator' });
  const managerQuery = useQuery({ ...workspaceContentOptions(workspace.id), enabled: Boolean(workspace.id) && workspace.role === 'manager' });
  const reviewerQuery = useQuery({ ...reviewQueueOptions(workspace.id), enabled: Boolean(workspace.id) && workspace.role === 'reviewer' });

  const firstName = data.profile.full_name.trim().split(/\s+/)[0] || 'there';
  const items: DashboardItem[] = workspace.role === 'creator'
    ? (creatorQuery.data ?? []).map((row) => ({ ...row, status: row.status as ContentStatus, type: row.type as ContentType, updatedAt: row.updated_at }))
    : workspace.role === 'manager'
      ? (managerQuery.data ?? []).map((row) => ({ ...row, status: row.status as ContentStatus, type: row.type as ContentType, updatedAt: row.submitted_at ?? row.updated_at }))
      : workspace.role === 'reviewer'
        ? (reviewerQuery.data ?? []).map((row) => ({ ...row, status: row.status as ContentStatus, type: row.type as ContentType, updatedAt: row.assigned_at, approvalStatus: row.approval_status }))
        : [];

  const activeQuery = workspace.role === 'creator' ? creatorQuery : workspace.role === 'manager' ? managerQuery : workspace.role === 'reviewer' ? reviewerQuery : null;
  const pendingDecisionCount = items.filter((item) => item.approvalStatus === 'open').length;
  const metrics = workspace.role === 'creator'
    ? [
        { label: 'Your content', value: items.length, icon: Files, tone: 'navy' },
        { label: 'Drafts', value: countStatus(items, 'draft'), icon: Layers3, tone: 'blue' },
        { label: 'Awaiting manager', value: countStatus(items, 'pending_manager'), icon: ClipboardCheck, tone: 'teal' },
        { label: 'Changes requested', value: countStatus(items, 'changes_requested'), icon: CircleAlert, tone: 'amber' },
      ]
    : workspace.role === 'manager'
      ? [
          { label: 'Submitted content', value: items.length, icon: Files, tone: 'navy' },
          { label: 'Awaiting manager', value: countStatus(items, 'pending_manager'), icon: ClipboardCheck, tone: 'blue' },
          { label: 'Awaiting reviewer', value: countStatus(items, 'pending_reviewer'), icon: ClipboardCheck, tone: 'teal' },
          { label: 'Approved', value: countStatus(items, 'approved'), icon: CheckCircle2, tone: 'green' },
        ]
      : workspace.role === 'reviewer'
        ? [
            { label: 'Assigned to you', value: items.length, icon: Files, tone: 'navy' },
            { label: 'Awaiting your decision', value: pendingDecisionCount, icon: ClipboardCheck, tone: 'blue' },
            { label: 'Decided', value: items.length - pendingDecisionCount, icon: CheckCircle2, tone: 'teal' },
          ]
        : [];

  const action = {
    creator: { title: 'Make your next piece of content', text: 'Start a draft, check it against your brand standards and submit it when it is ready.', label: 'Create content', to: '/content/new' as const, icon: FilePlus2 },
    manager: { title: 'Keep work moving', text: 'Review submitted content and see what is waiting for your decision.', label: 'View submitted content', to: '/content/all' as const, icon: Files },
    reviewer: { title: 'Review with confidence', text: 'Open content assigned to you and consider its findings before deciding.', label: 'Open review queue', to: '/review' as const, icon: ClipboardCheck },
    admin: { title: 'Keep your brand standard current', text: 'Maintain the guidelines, facts and terminology Markwise uses to ground its checks.', label: 'Open Knowledge Base', to: '/knowledge' as const, icon: BookOpenCheck },
  }[workspace.role];

  const recentTitle = workspace.role === 'reviewer' ? 'Recent assignments' : workspace.role === 'manager' ? 'Recent submissions' : 'Your recent content';

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-8">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">
            <span className="size-1.5 rounded-full bg-brand-teal" aria-hidden="true" />{workspace.role === 'admin' ? 'Brand governance' : 'Workspace overview'}
          </div>
          <h1 id="dashboard-title" className="text-[1.75rem] font-semibold leading-tight tracking-[-0.04em] text-brand-navy sm:text-4xl">{workspace.role === 'admin' ? 'Workspace control' : `Welcome back, ${firstName}`}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{workspace.role === 'admin' ? 'Keep your standards, team access and AI review records in view.' : 'A clear view of your workspace and the work that needs your attention.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="w-fit shrink-0 gap-2 rounded-full border-brand-teal/25 bg-brand-teal/5 px-3 py-1.5 text-brand-navy">
            <span className="size-2 rounded-full bg-brand-teal" aria-hidden="true" />{roleLabel(workspace.role)} access
          </Badge>
        </div>
      </header>

      {workspace.role === 'admin' ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)]" aria-label="Workspace administration">
            <div className="relative flex min-h-[17rem] flex-col justify-between overflow-hidden rounded-2xl bg-brand-ink p-5 text-white shadow-lg shadow-brand-ink/10 sm:min-h-[19rem] sm:p-8">
              <div className="relative flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-brand-teal"><BookOpenCheck className="size-5" aria-hidden="true" /></span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Brand governance</p>
                  <p className="mt-1 text-sm font-medium text-white">Knowledge Base</p>
                </div>
              </div>
              <div className="relative mt-7 max-w-xl sm:mt-10">
                <h2 className="text-xl font-semibold leading-tight tracking-[-0.03em] sm:text-3xl">Maintain a trusted brand standard.</h2>
                <p className="mt-2.5 max-w-lg text-[13px] leading-5 text-slate-300 sm:mt-3 sm:text-sm sm:leading-6">Manage the guidelines, approved facts and terminology used to ground content checks in your workspace.</p>
              </div>
              <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 sm:mt-8 sm:gap-4 sm:pt-5">
                <span className="flex items-center gap-2 text-xs text-slate-300"><ShieldCheck className="size-4 text-brand-teal" aria-hidden="true" />Human judgment stays central</span>
                <Button asChild className="w-full justify-between bg-white text-brand-ink shadow-none hover:bg-slate-100 sm:w-auto"><Link to="/knowledge">Open Knowledge Base<ArrowRight aria-hidden="true" /></Link></Button>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="mb-4 border-b border-border pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace operations</p>
                <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-brand-navy">Administration</h2>
              </div>
              <div className="flex flex-1 flex-col divide-y divide-border">
                <AdminAction title="Workspace members" text="Manage members and their assigned roles." to="/users" icon={Users} />
                <AdminAction title="AI call log" text="Review the workspace’s recorded AI requests." to="/ai-calls" icon={Bot} />
              </div>
            </div>
          </section>
          <p className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-brand-teal" aria-hidden="true" />Admin view <span className="font-medium text-foreground">{workspace.name}</span></p>
        </>
      ) : (
        <>
          <section className="grid overflow-hidden rounded-2xl border border-brand-ink bg-brand-ink text-white shadow-lg shadow-brand-ink/10 lg:grid-cols-[minmax(0,1fr)_17rem]" aria-label="Recommended next step">
            <div className="flex flex-col justify-between gap-7 p-5 sm:p-7 lg:p-8">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300"><action.icon className="size-4 text-brand-teal" aria-hidden="true" />A useful next step</div>
              <div><h2 className="max-w-xl text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-[1.75rem]">{action.title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{action.text}</p></div>
              <Button asChild className="w-full justify-between rounded-lg bg-white px-4 text-brand-ink shadow-none hover:bg-slate-100 sm:w-fit sm:min-w-52"><Link to={action.to}>{action.label}<ArrowRight aria-hidden="true" /></Link></Button>
            </div>
            <div className="hidden border-l border-white/10 bg-white/[0.035] p-7 lg:flex lg:flex-col lg:justify-between">
              <span className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-brand-teal"><ShieldCheck className="size-5" aria-hidden="true" /></span>
              <div><p className="text-xs font-semibold text-white">Human judgment stays central</p><p className="mt-2 text-xs leading-5 text-slate-300">Markwise explains and cites. Your team makes the final call.</p></div>
            </div>
          </section>

          <section aria-labelledby="overview-title">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="overview-title" className="text-sm font-semibold text-brand-navy">At a glance</h2>
                <p className="mt-1 text-xs text-muted-foreground">Based on records available to your role.</p>
              </div>
              {workspace.role === 'manager' && <Button asChild variant="ghost" size="sm"><Link to="/content/all">All content<ArrowUpRight aria-hidden="true" /></Link></Button>}
              {workspace.role === 'reviewer' && <Button asChild variant="ghost" size="sm"><Link to="/review">Review queue<ArrowUpRight aria-hidden="true" /></Link></Button>}
              {workspace.role === 'creator' && <Button asChild variant="ghost" size="sm"><Link to="/content">My content<ArrowUpRight aria-hidden="true" /></Link></Button>}
            </div>
            <div className={`grid overflow-hidden rounded-xl border border-border bg-card shadow-sm ${metrics.length === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
              {metrics.map((metric, index) => (
                <div key={metric.label} className={`min-w-0 p-4 sm:p-5 ${index > 0 ? 'border-l border-border' : ''} ${index === 2 ? 'xl:border-l' : ''} ${index === 3 ? 'col-span-2 border-t xl:col-span-1 xl:border-t-0 xl:border-l' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-h-8 text-xs leading-4 text-muted-foreground sm:text-sm">{metric.label}</p>
                    <metric.icon className={`hidden size-4 shrink-0 sm:block ${metric.tone === 'teal' || metric.tone === 'green' ? 'text-brand-teal' : metric.tone === 'amber' ? 'text-status-warning' : 'text-brand-blue'}`} aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-brand-navy sm:text-3xl">{activeQuery?.isPending || activeQuery?.error ? '—' : metric.value}</p>
                </div>
              ))}
            </div>
          </section>

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 border-b border-border/70 px-5 py-4 sm:px-6">
              <div>
                <CardTitle className="text-base text-brand-navy">{recentTitle}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">The latest work available in this workspace.</p>
              </div>
              {activeQuery && !activeQuery.isPending && !activeQuery.error && items.length > 0 && <span className="hidden text-xs text-muted-foreground sm:block">Latest activity</span>}
            </CardHeader>
            <CardContent className="p-0">
              {activeQuery?.isPending ? (
                <div className="space-y-3 p-5" aria-label="Loading recent content" aria-busy="true">
                  <div className="h-14 animate-pulse rounded-lg bg-muted" /><div className="h-14 animate-pulse rounded-lg bg-muted" />
                </div>
              ) : activeQuery?.error ? (
                <div role="alert" className="m-5 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">We couldn’t load recent workspace content. <button className="ml-1 font-semibold underline underline-offset-2" onClick={() => void activeQuery.refetch()}>Try again</button></div>
              ) : items.length === 0 ? (
                <div className="px-5 py-10 text-center sm:py-12">
                  <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><Files className="size-5" aria-hidden="true" /></span>
                  <p className="mt-3 font-medium text-brand-navy">{workspace.role === 'reviewer' ? 'Nothing is assigned to you yet.' : workspace.role === 'manager' ? 'No submitted content yet.' : 'Your content will appear here.'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{workspace.role === 'creator' ? 'Create a draft when you’re ready to get started.' : 'This list will update when new work is available.'}</p>
                  {workspace.role === 'creator' && <Button asChild size="sm" className="mt-4"><Link to="/content/new"><FilePlus2 aria-hidden="true" />Create content</Link></Button>}
                </div>
              ) : (
                <ul className="divide-y divide-border/80">
                  {items.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <Link to="/content/$id" params={{ id: item.id }} className="group flex min-w-0 flex-col gap-3 px-5 py-4 outline-none transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:px-6">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/8 text-brand-blue"><TypeIcon type={item.type} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-brand-navy group-hover:text-brand-blue">{item.title}</span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">{item.type} · {item.channel || 'No channel'} · v{item.version}{item.ownerName ? ` · ${item.ownerName}` : ''}</span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <StatusBadge status={item.status} />
                          <span className="whitespace-nowrap text-xs text-muted-foreground">{workspace.role === 'reviewer' ? 'Assigned' : workspace.role === 'manager' ? 'Submitted' : 'Updated'} {formatDate(item.updatedAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {workspace.role !== 'admin' && <p className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-brand-teal" aria-hidden="true" />Showing the {workspace.role} view for <span className="font-medium text-foreground">{workspace.name}</span>.</p>}
    </div>
  );
}

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function countStatus(items: DashboardItem[], status: ContentStatus) {
  return items.filter((item) => item.status === status).length;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'date unavailable' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function AdminAction({ title, text, to, icon: Icon }: { title: string; text: string; to: '/users' | '/ai-calls'; icon: typeof Users }) {
  return (
    <Link to={to} className="group -mx-2 flex flex-1 items-start gap-3 rounded-lg px-2 py-5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring first:pt-2 last:pb-2">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/8 text-brand-blue"><Icon className="size-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 text-sm font-semibold text-brand-navy group-hover:text-brand-blue">{title}<ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /></span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{text}</span></span>
    </Link>
  );
}
