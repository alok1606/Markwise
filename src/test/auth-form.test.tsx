import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from '@/components/auth-form';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), recovery: false,
  oauth: vi.fn(), login: vi.fn(), signup: vi.fn(), reset: vi.fn(), update: vi.fn(), logout: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));
vi.mock('@/components/auth-provider', () => ({ useAuth: () => ({ user: null, recovery: mocks.recovery }) }));
vi.mock('@/integrations/lovable', () => ({ lovable: { auth: { signInWithOAuth: mocks.oauth } } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  signInWithPassword: mocks.login, signUp: mocks.signup, resetPasswordForEmail: mocks.reset,
  updateUser: mocks.update, signOut: mocks.logout,
} } }));

beforeEach(() => {
  vi.resetAllMocks(); mocks.recovery = false;
  mocks.oauth.mockResolvedValue({ redirected: true });
  for (const fn of [mocks.login, mocks.reset, mocks.update, mocks.logout]) fn.mockResolvedValue({ error: null });
  mocks.signup.mockResolvedValue({ data: { session: null }, error: null });
});
afterEach(cleanup);
describe('Retained Markwise authentication flows', () => {
  it.each(['login', 'signup'] as const)('starts Google OAuth from %s with a public same-origin return', async mode => {
    render(<AuthForm mode={mode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mocks.oauth).toHaveBeenCalledExactlyOnceWith('google', { redirect_uri: window.location.origin }));
  });
  it('submits email/password and enters the workspace after success', async () => {
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'person@example.com' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'TestPassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledExactlyOnceWith({ email: 'person@example.com', password: 'TestPassword123' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/dashboard' }));
  });
  it('keeps unconfirmed email signup signed out with a same-origin confirmation return', async () => {
    render(<AuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test Person' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'person@example.com' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'TestPassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(mocks.signup).toHaveBeenCalledExactlyOnceWith({ email: 'person@example.com', password: 'TestPassword123', options: { data: { full_name: 'Test Person' }, emailRedirectTo: window.location.origin } }));
    await screen.findByRole('status');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it('requests recovery using the public reset page', async () => {
    render(<AuthForm mode="forgot" />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'person@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    await waitFor(() => expect(mocks.reset).toHaveBeenCalledExactlyOnceWith('person@example.com', { redirectTo: `${window.location.origin}/reset-password` }));
  });
  it('updates a verified recovery password and signs out without requiring the current password', async () => {
    mocks.recovery = true;
    render(<AuthForm mode="reset" />);
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'NewPassword123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ password: 'NewPassword123' }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
  });
});