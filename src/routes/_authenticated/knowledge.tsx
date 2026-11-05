import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { useWorkspace } from '@/components/app-shell';
import { canManageKnowledge } from '@/lib/knowledge';
import { meta } from '@/lib/access';

export const Route = createFileRoute('/_authenticated/knowledge')({ head: () => meta('Knowledge base', 'Brand profile, guidelines, rules, approved facts, glossary and visual identity.'), component: KnowledgeLayout });

const tabs = [
  { to: '/knowledge', label: 'Overview' }, { to: '/knowledge/profile', label: 'Brand profile' }, { to: '/knowledge/guidelines', label: 'Guidelines' },
  { to: '/knowledge/rules', label: 'Rules' }, { to: '/knowledge/facts', label: 'Facts' }, { to: '/knowledge/glossary', label: 'Glossary' }, { to: '/knowledge/visual', label: 'Visual identity' },
] as const;

function KnowledgeLayout() {
  const workspace = useWorkspace(); const { pathname } = useLocation();
  if (!canManageKnowledge(workspace.role)) return <><ShieldCheck className="size-8 text-primary" /><h1 className="mt-5 text-2xl font-semibold">Administrator access required</h1><p className="mt-3 text-muted-foreground">Only your workspace administrator can manage the brand knowledge base.</p></>;
  return <>
    <p className="mb-3 text-xs font-semibold uppercase text-primary">Brand knowledge base</p>
    <h1 className="text-3xl font-semibold">{workspace.name}</h1>
    <nav aria-label="Knowledge base sections" className="mt-6 flex gap-1 overflow-x-auto border-b">{tabs.map(t => <Link key={t.to} to={t.to} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${pathname === t.to ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t.label}</Link>)}</nav>
    <div key={workspace.id} className="mt-8"><Outlet /></div>
  </>;
}
