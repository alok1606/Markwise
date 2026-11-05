import { Link, Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { chooseWorkspace, orderMemberships, roleLabel, workspaceStorageKey } from '@/lib/workspace-selection';
import { Building2, ChevronDown, LayoutDashboard, Users, UserRound, Settings2, CircleHelp, LogOut, Menu, X, LockKeyhole, BookOpenCheck, Files, FilePlus2, ClipboardCheck, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Brand } from './brand';
import { accessOptions } from '@/lib/queries';
import { roleNavigation, type Role } from '@/lib/access';
import { supabase } from '@/integrations/supabase/client';
const navLinks: Record<string, { to: '/knowledge' | '/users' | '/content' | '/content/new' | '/content/all' | '/review' | '/ai-calls'; icon: typeof Users; active: (p: string) => boolean }> = {
  'AI Calls': { to: '/ai-calls', icon: Bot, active: p => p === '/ai-calls' },
  'Knowledge Base': { to: '/knowledge', icon: BookOpenCheck, active: p => p.startsWith('/knowledge') },
  Users: { to: '/users', icon: Users, active: p => p === '/users' },
  'My Content': { to: '/content', icon: Files, active: p => p === '/content' || (p.startsWith('/content/') && p !== '/content/new' && p !== '/content/all') },
  'New Content': { to: '/content/new', icon: FilePlus2, active: p => p === '/content/new' },
  'All Content': { to: '/content/all', icon: Files, active: p => p === '/content/all' },
  'Review Queue': { to: '/review', icon: ClipboardCheck, active: p => p === '/review' },
};
const WorkspaceContext = createContext<{ id: string; name: string; role: Role }>({ id: '', name: '', role: 'creator' });
export const useWorkspace = () => useContext(WorkspaceContext);
export function AppShell() {
  const { data } = useSuspenseQuery(accessOptions); const [selected, setSelected] = useState(''); const [open, setOpen] = useState(false);
  const userId = data.profile.id;
  const memberships = useMemo(() => orderMemberships(data.memberships, userId), [data.memberships, userId]);
  useEffect(() => { let stored: string | null = null; try { stored = localStorage.getItem(workspaceStorageKey(userId)); } catch { /* storage unavailable */ } setSelected(chooseWorkspace(memberships, userId, stored)); }, [memberships, userId]);
  const workspace = memberships.find(m => m.workspace_id === selected) ?? memberships[0];
  function selectWorkspace(id: string) { if (!memberships.some(m => m.workspace_id === id)) return; setSelected(id); try { localStorage.setItem(workspaceStorageKey(userId), id); } catch { /* storage unavailable */ } }
  const current = { id: workspace?.workspace_id ?? '', name: workspace?.workspaces?.name ?? 'Workspace', role: workspace?.role ?? 'creator' };
  const queryClient = useQueryClient(); const navigate = useNavigate(); const location = useLocation();
  async function signOut() { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); await navigate({ to: '/auth', replace: true }); }
  return <WorkspaceContext.Provider value={current}><div className="min-h-screen bg-background">
    <header className="flex h-16 items-center justify-between border-b bg-card px-5 md:hidden"><Brand /><Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></Button></header>
    {open && <div className="fixed inset-0 z-30 bg-foreground/30 md:hidden" onClick={() => setOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-sidebar px-5 py-7 transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between"><Link to="/"><Brand /></Link><Button variant="ghost" size="icon" className="md:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}><X /></Button></div>
      <div className="my-8 flex items-center gap-3 border-y py-4"><Building2 className="size-5 text-muted-foreground" /><div className="min-w-0 flex-1"><label htmlFor="workspace" className="text-[10px] font-semibold uppercase text-muted-foreground">Workspace</label><select id="workspace" className="w-full bg-transparent text-sm font-medium" value={current.id} onChange={e => { selectWorkspace(e.target.value); void navigate({ to: '/dashboard' }); }}>{memberships.map(m => <option key={m.workspace_id} value={m.workspace_id}>{`${m.workspaces?.name ?? 'Workspace'} · ${roleLabel(m.role)}`}</option>)}</select></div><ChevronDown className="size-4" /></div>
      <p className="mb-3 text-[10px] font-semibold uppercase text-muted-foreground">Workspace navigation</p>
      <nav className="space-y-1"><Button asChild variant={location.pathname === '/dashboard' ? 'secondary' : 'ghost'} className="w-full justify-start"><Link to="/dashboard" onClick={() => setOpen(false)}><LayoutDashboard />Overview</Link></Button>
      {roleNavigation[current.role].map(label => { const item = navLinks[label]; return item ? <Button asChild key={label} variant={item.active(location.pathname) ? 'secondary' : 'ghost'} className="w-full justify-start"><Link to={item.to} onClick={() => setOpen(false)}><item.icon />{label}</Link></Button> : <div key={label} className="flex items-center justify-between px-3 py-2.5 text-sm text-muted-foreground" aria-disabled="true"><span>{label}</span><LockKeyhole className="size-3.5" /></div>; })}</nav>
      <div className="mt-auto space-y-1 border-t pt-4">{[{ label: 'Profile', to: '/profile' as const, icon: UserRound }, { label: 'Settings', to: '/settings' as const, icon: Settings2 }, { label: 'Help', to: '/help' as const, icon: CircleHelp }].map(item => <Button asChild key={item.to} variant={location.pathname === item.to ? 'secondary' : 'ghost'} className="w-full justify-start"><Link to={item.to} onClick={() => setOpen(false)}><item.icon />{item.label}</Link></Button>)}
      <div className="mt-4 flex items-center gap-3 border-t pt-5">{data.avatar ? <img src={data.avatar} alt="Your avatar" className="size-9 rounded-full object-cover" /> : <span className="flex size-9 items-center justify-center rounded-full bg-accent font-medium">{data.profile.full_name.slice(0, 1) || 'M'}</span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{data.profile.full_name || 'Your account'}</p><p className="text-xs capitalize text-muted-foreground">{current.role}</p></div><Button variant="ghost" size="icon" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut /></Button></div></div>
    </aside>
    <main className="md:ml-64"><div className="hidden h-16 items-center justify-between border-b bg-card px-10 md:flex"><span className="text-sm text-muted-foreground">{current.name}</span><span className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" />Private workspace</span></div><div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10"><Outlet /></div></main>
  </div></WorkspaceContext.Provider>;
}