import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brand } from './brand';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useAuth } from './auth-provider';
import { credentialsSchema } from '@/lib/access';
export function AuthForm({ mode }: { mode: 'login' | 'signup' | 'forgot' | 'reset' }) {
  const { register, handleSubmit } = useForm<{ full_name: string; email: string; password: string; confirm: string }>();
  const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false); const [recovery, setRecovery] = useState(false);
  const { user, recovery: recoverySession } = useAuth(); const navigate = useNavigate();
  useEffect(() => {
    if (mode === 'reset') setRecovery(recoverySession);
    else if (user && (mode === 'login' || mode === 'signup')) void navigate({ to: '/dashboard', replace: true });
  }, [user, recoverySession, mode, navigate]);
  const title = { login: 'Welcome back.', signup: 'Create your account.', forgot: 'Reset your password.', reset: 'Set a new password.' }[mode];
  async function submit(values: { full_name: string; email: string; password: string; confirm: string }) {
    setBusy(true); setError(''); setSuccess('');
    try {
      if (mode === 'login' || mode === 'signup') {
        const credentials = credentialsSchema.parse(values);
        if (mode === 'signup') {
          if (!values.full_name.trim()) throw new Error('Enter your full name');
          const { data, error } = await supabase.auth.signUp({ ...credentials, options: { data: { full_name: values.full_name.trim() }, emailRedirectTo: window.location.origin } });
          if (error) throw error;
          if (!data.session) setSuccess('Check your email to confirm your account. Then return here to sign in.');
          else await navigate({ to: '/dashboard' });
        } else { const { error } = await supabase.auth.signInWithPassword(credentials); if (error) throw error; await navigate({ to: '/dashboard' }); }
      } else if (mode === 'forgot') {
        const email = credentialsSchema.shape.email.parse(values.email);
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); if (error) throw error;
        setSuccess('If an account exists for that email, you’ll receive a password reset link.');
      } else {
        if (!recovery) throw new Error('Open the password reset link from your email first.');
        const password = credentialsSchema.shape.password.parse(values.password);
        if (password !== values.confirm) throw new Error('Passwords do not match');
        const { error } = await supabase.auth.updateUser({ password }); if (error) throw error;
        setSuccess('Password updated. You can now sign in with your new password.');
        await supabase.auth.signOut();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete this request'); } finally { setBusy(false); }
  }
  async function social(provider: 'google' | 'lovable') { setBusy(true); setError(''); try { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (result.error) throw result.error; } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed'); } finally { setBusy(false); } }
  return <div className="min-h-screen bg-background"><header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7"><Link to="/"><Brand /></Link><Button asChild variant="ghost"><Link to="/">Back to home <ArrowRight /></Link></Button></header><main className="mx-auto max-w-md px-6 pb-16 pt-14"><p className="mb-4 text-xs font-semibold uppercase text-primary">Your brand. In good hands.</p><h1 className="text-3xl font-semibold">{title}</h1><p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">{mode === 'signup' ? 'A considered space for your team and your brand.' : mode === 'login' ? 'Sign in to your Markwise workspace.' : 'Keep your account secure with a new password.'}</p>
    {(mode === 'login' || mode === 'signup') && <><div className="grid grid-cols-2 gap-3"><Button variant="outline" disabled={busy} onClick={() => social('google')}>Google</Button><Button variant="outline" disabled={busy} onClick={() => social('lovable')}>Lovable</Button></div><div className="my-6 flex items-center gap-4 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with email<span className="h-px flex-1 bg-border" /></div></>}
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
    {mode === 'signup' && <div className="space-y-2"><Label htmlFor="full_name">Full name</Label><Input id="full_name" autoComplete="name" maxLength={100} required {...register('full_name')} /></div>}
    {mode !== 'reset' && <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" placeholder="you@company.com" required {...register('email')} /></div>}
    {mode !== 'forgot' && <div className="space-y-2"><div className="flex justify-between"><Label htmlFor="password">Password</Label>{mode === 'login' && <Link to="/forgot-password" className="text-xs text-primary">Forgot password?</Link>}</div><div className="relative"><Input id="password" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required className="pr-12" {...register('password')} /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <EyeOff /> : <Eye />}</Button></div>{mode !== 'login' && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}</div>}
    {mode === 'reset' && <div className="space-y-2"><Label htmlFor="confirm">Confirm new password</Label><Input id="confirm" type="password" required {...register('confirm')} /></div>}
    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}{success && <p role="status" className="rounded-md border border-primary/30 bg-accent p-3 text-sm">{success}</p>}
    <Button className="w-full" size="lg" disabled={busy || (mode === 'reset' && !recovery)}>{busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}{mode === 'signup' ? 'Create account' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Update password'}</Button></form>
    <p className="mt-7 text-center text-sm text-muted-foreground">{mode === 'signup' ? <>Already have an account? <Link to="/auth" className="font-medium text-primary">Sign in</Link></> : mode === 'login' ? <>New to Markwise? <Link to="/signup" className="font-medium text-primary">Create an account</Link></> : <Link to="/auth" className="font-medium text-primary">Back to sign in</Link>}</p>
  </main></div>;
}