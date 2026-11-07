import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { BookOpenCheck, Building2, FileText, Image, ListChecks, Palette, ShieldCheck, Type } from 'lucide-react';
import { useWorkspace } from '@/components/app-shell';
import { canManageKnowledge } from '@/lib/knowledge';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/knowledge')({ head: () => meta('Knowledge base', 'Brand profile, guidelines, rules, approved facts, glossary and visual identity.'), component: KnowledgeLayout });

const tabs = [
  { to: '/knowledge', label: 'Overview', icon: Building2 }, { to: '/knowledge/profile', label: 'Brand profile', icon: BookOpenCheck },
  { to: '/knowledge/guidelines', label: 'Guidelines', icon: FileText }, { to: '/knowledge/rules', label: 'Rules', icon: ListChecks },
  { to: '/knowledge/facts', label: 'Approved facts', icon: ShieldCheck }, { to: '/knowledge/glossary', label: 'Glossary', icon: Type },
  { to: '/knowledge/visual', label: 'Visual identity', icon: Palette },
] as const;

function KnowledgeLayout() {
  const workspace = useWorkspace(); const { pathname } = useLocation();
  if (!canManageKnowledge(workspace.role)) return <><ShieldCheck className="size-8 text-primary" /><h1 className="mt-5 text-2xl font-semibold">Administrator access required</h1><p className="mt-3 text-muted-foreground">Only your workspace administrator can manage the brand knowledge base.</p></>;
  return <div className="mx-auto max-w-[1440px]">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
      <div><p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700"><span className="size-1.5 rounded-full bg-teal-600" />Brand governance</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.1rem]">Knowledge base</h1>
        <p className="mt-2 text-sm text-slate-600">The standards and approved sources behind your content reviews.</p>
      </div>
      <div className="rounded-full border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-medium text-teal-900">{workspace.name}</div>
    </header>
    <div className="grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Knowledge base sections" className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:border-r lg:border-slate-200 lg:pr-5">
        <p className="hidden px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 lg:block">Workspace library</p>
        {tabs.map(t => { const Icon = t.icon; const active = pathname === t.to; return <Link key={t.to} to={t.to} aria-current={active ? 'page' : undefined} className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:w-full ${active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><Icon aria-hidden="true" className={`size-4 ${active ? 'text-teal-300' : 'text-slate-400'}`} />{t.label}</Link>; })}
      </nav>
      <main key={workspace.id} className="min-w-0"><Outlet /></main>
    </div>
  </div>;
}
