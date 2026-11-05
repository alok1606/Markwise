import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/components/auth-provider';

const mocks = vi.hoisted(() => ({
  listener: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void),
  invalidate: vi.fn(),
  router: { invalidate: vi.fn() },
  queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock('@tanstack/react-router', () => ({ useRouter: () => mocks.router }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => mocks.queryClient }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  onAuthStateChange: (listener: typeof mocks.listener) => {
    mocks.listener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  },
  getUser: async () => ({ data: { user: null } }),
} } }));
function RecoveryProbe() {
  const { recovery } = useAuth();
  return <output data-testid="recovery">{String(recovery)}</output>;
}
describe('Password recovery session', () => {
  it('recognizes verified recovery after the SDK removes the URL fragment, and clears it on sign-out', async () => {
    window.history.replaceState(null, '', '/reset-password');
    render(<AuthProvider><RecoveryProbe /></AuthProvider>);
    await act(async () => {});
    expect(screen.getByTestId('recovery').textContent).toBe('false');
    act(() => mocks.listener?.('PASSWORD_RECOVERY', { user: { id: 'recovery-user' } }));
    expect(screen.getByTestId('recovery').textContent).toBe('true');
    act(() => mocks.listener?.('SIGNED_OUT', null));
    expect(screen.getByTestId('recovery').textContent).toBe('false');
  });
});