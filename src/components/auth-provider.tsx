import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
const AuthContext = createContext<{ user: User | null; loading: boolean; recovery: boolean }>({ user: null, loading: true, recovery: false });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const router = useRouter(); const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    let identity: string | null = null;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const nextIdentity = session?.user.id ?? null;
      const changedIdentity = identity !== null && identity !== nextIdentity;
      identity = nextIdentity;
      if (event === 'SIGNED_OUT' || changedIdentity) {
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      setUser(session?.user ?? null); setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
      void router.invalidate();
      if (event !== 'SIGNED_OUT') void queryClient.invalidateQueries();
    });
    void supabase.auth.getUser().then(({ data }) => { if (active) { setUser(data.user); setLoading(false); } });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [router, queryClient]);
  return <AuthContext.Provider value={{ user, loading, recovery }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);