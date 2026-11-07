import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Bot,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FilePlus2,
  Files,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Settings2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { chooseWorkspace, orderMemberships, roleLabel, workspaceStorageKey } from '@/lib/workspace-selection';
import { Button } from '@/components/ui/button';
import { Brand } from './brand';
import { accessOptions } from '@/lib/queries';
import { roleNavigation, type Role } from '@/lib/access';
import { supabase } from '@/integrations/supabase/client';

const navLinks: Record<string, { to: '/knowledge' | '/users' | '/content' | '/content/new' | '/content/all' | '/review' | '/ai-calls'; icon: typeof Users; active: (path: string) => boolean }> = {
  Reviews: { to: '/review', icon: ClipboardCheck, active: (path) => path === '/review' || path.startsWith('/content/') },
  'AI Calls': { to: '/ai-calls', icon: Bot, active: (path) => path === '/ai-calls' },
  'Knowledge Base': { to: '/knowledge', icon: BookOpenCheck, active: (path) => path.startsWith('/knowledge') },
  Users: { to: '/users', icon: Users, active: (path) => path === '/users' },
  'My Content': { to: '/content', icon: Files, active: (path) => path === '/content' || (path.startsWith('/content/') && path !== '/content/new' && path !== '/content/all') },
  'New Content': { to: '/content/new', icon: FilePlus2, active: (path) => path === '/content/new' },
  'All Content': { to: '/content/all', icon: Files, active: (path) => path === '/content/all' },
  'Review Queue': { to: '/review', icon: ClipboardCheck, active: (path) => path === '/review' },
};

const WorkspaceContext = createContext<{ id: string; name: string; role: Role }>({ id: '', name: '', role: 'creator' });
export const useWorkspace = () => useContext(WorkspaceContext);

export function AppShell() {
  const { data } = useSuspenseQuery(accessOptions);
  const [selected, setSelected] = useState('');
  const [open, setOpen] = useState(false);
  const userId = data.profile.id;
  const memberships = useMemo(() => orderMemberships(data.memberships, userId), [data.memberships, userId]);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(workspaceStorageKey(userId)); } catch { /* storage unavailable */ }
    setSelected(chooseWorkspace(memberships, userId, stored));
  }, [memberships, userId]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const workspace = memberships.find((membership) => membership.workspace_id === selected) ?? memberships[0];
  function selectWorkspace(id: string) {
    if (!memberships.some((membership) => membership.workspace_id === id)) return;
    setSelected(id);
    try { localStorage.setItem(workspaceStorageKey(userId), id); } catch { /* storage unavailable */ }
  }

  const current = {
    id: workspace?.workspace_id ?? '',
    name: workspace?.workspaces?.name ?? 'Workspace',
    role: workspace?.role ?? 'creator',
  };
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: '/auth', replace: true });
  }

  const visibleItems = roleNavigation[current.role];
  const contentItems = visibleItems.filter((label) => !['Knowledge Base', 'Users', 'AI Calls'].includes(label));
  const governanceItems = visibleItems.filter((label) => label === 'Knowledge Base');
  const adminItems = visibleItems.filter((label) => label === 'Users' || label === 'AI Calls');

  return (
    <WorkspaceContext.Provider value={current}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-20 flex h-[4.25rem] items-center justify-between border-b border-border bg-card px-4 shadow-sm md:hidden">
          <Link to="/" aria-label="Markwise home"><Brand /></Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="max-w-28 truncate text-xs text-muted-foreground">{current.name}</span>
            <Button
              variant="outline"
              size="icon"
              aria-label={open ? 'Close navigation' : 'Open navigation'}
              aria-expanded={open}
              aria-controls="workspace-sidebar"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </header>

        {open && (
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default bg-brand-navy/35 backdrop-blur-[1px] md:hidden"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
        )}

        <aside
          id="workspace-sidebar"
          aria-label="Workspace navigation"
            className={`fixed inset-y-0 left-0 z-40 flex w-[min(18rem,calc(100vw-2rem))] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground shadow-2xl shadow-brand-ink/20 transition-transform duration-200 md:w-[276px] md:translate-x-0 md:px-5 md:py-6 md:shadow-none ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center justify-between border-b border-sidebar-border px-1 pb-5">
            <Link to="/" aria-label="Markwise home" onClick={() => setOpen(false)}><Brand inverse /></Link>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}><X /></Button>
          </div>

          <div className="my-6 rounded-xl border border-white/10 bg-white/[0.055] p-3.5 shadow-inner shadow-white/[0.02]">
            <label htmlFor="workspace" className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              <Building2 className="size-3.5 text-brand-teal" aria-hidden="true" />Workspace
            </label>
            <div className="relative">
              <select
                id="workspace"
                className="h-9 w-full appearance-none rounded-md bg-transparent pr-7 text-sm font-medium text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring [&>option]:text-foreground"
                value={current.id}
                onChange={(event) => { selectWorkspace(event.target.value); setOpen(false); void navigate({ to: '/dashboard' }); }}
              >
                {memberships.map((membership) => (
                  <option key={membership.workspace_id} value={membership.workspace_id}>
                    {`${membership.workspaces?.name ?? 'Workspace'} · ${roleLabel(membership.role)}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-1 truncate text-xs capitalize text-slate-400">{roleLabel(current.role)} access</p>
          </div>

          <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto" aria-label="Workspace sections">
            <NavGroup title="Overview">
              <NavItem label="Overview" to="/dashboard" icon={LayoutDashboard} active={location.pathname === '/dashboard'} onNavigate={() => setOpen(false)} />
            </NavGroup>
            {contentItems.length > 0 && (
              <NavGroup title={current.role === 'reviewer' || current.role === 'admin' ? 'Reviews' : 'Content'}>
                {contentItems.map((label) => <RoleNavItem key={label} label={label} path={location.pathname} onNavigate={() => setOpen(false)} />)}
              </NavGroup>
            )}
            {governanceItems.length > 0 && (
              <NavGroup title="Brand governance">
                {governanceItems.map((label) => <RoleNavItem key={label} label={label} path={location.pathname} onNavigate={() => setOpen(false)} />)}
              </NavGroup>
            )}
            {adminItems.length > 0 && (
              <NavGroup title="Administration">
                {adminItems.map((label) => <RoleNavItem key={label} label={label} path={location.pathname} onNavigate={() => setOpen(false)} />)}
              </NavGroup>
            )}
          </nav>

          <div className="mt-5 space-y-1 border-t border-sidebar-border pt-4">
            <NavItem label="Profile" to="/profile" icon={UserRound} active={location.pathname === '/profile'} onNavigate={() => setOpen(false)} />
            <NavItem label="Settings" to="/settings" icon={Settings2} active={location.pathname === '/settings'} onNavigate={() => setOpen(false)} />
            <NavItem label="Help" to="/help" icon={CircleHelp} active={location.pathname === '/help'} onNavigate={() => setOpen(false)} />
            <div className="mt-4 flex items-center gap-3 border-t border-sidebar-border px-1 pt-4">
              {data.avatar ? (
                <img src={data.avatar} alt="Your avatar" className="size-9 shrink-0 rounded-full object-cover ring-2 ring-background" />
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 font-semibold text-white" aria-hidden="true">
                  {data.profile.full_name.slice(0, 1) || 'M'}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{data.profile.full_name || 'Your account'}</p>
                <p className="text-xs capitalize text-slate-400">{current.role}</p>
              </div>
              <Button variant="ghost" size="icon" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut /></Button>
            </div>
          </div>
        </aside>

        <main className="min-h-screen md:ml-[276px]">
          <header className="sticky top-0 z-10 hidden h-[4.25rem] items-center justify-between border-b border-border bg-card px-8 md:flex lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Workspace</span>
              <span className="text-border" aria-hidden="true">/</span>
              <span className="truncate text-sm font-medium text-brand-navy">{current.name}</span>
            </div>
            <span className="flex shrink-0 items-center gap-2 rounded-full border border-brand-teal/20 bg-brand-teal/5 px-3 py-1.5 text-xs font-medium text-brand-navy">
              <LockKeyhole className="size-3.5 text-brand-teal" aria-hidden="true" />Private workspace
            </span>
          </header>
          <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}

function NavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function RoleNavItem({ label, path, onNavigate }: { label: string; path: string; onNavigate: () => void }) {
  const item = navLinks[label];
  if (!item) return null;
  return <NavItem label={label} to={item.to} icon={item.icon} active={item.active(path)} onNavigate={onNavigate} />;
}

function NavItem({ label, to, icon: Icon, active, onNavigate }: {
  label: string;
  to: '/dashboard' | '/profile' | '/settings' | '/help' | '/knowledge' | '/users' | '/content' | '/content/new' | '/content/all' | '/review' | '/ai-calls';
  icon: typeof Users;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      aria-current={active ? 'page' : undefined}
      className={`relative h-10 w-full justify-start rounded-lg px-3 text-sm font-medium transition-colors ${active ? 'bg-white/[0.11] text-white after:absolute after:bottom-2 after:left-0 after:top-2 after:w-[3px] after:rounded-r-full after:bg-brand-teal hover:bg-white/[0.14] hover:text-white' : 'text-slate-300/75 hover:bg-white/[0.07] hover:text-white'}`}
    >
      <Link to={to} onClick={onNavigate}>
        <Icon className={`size-4 ${active ? 'text-brand-teal' : 'text-slate-400'}`} aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}
