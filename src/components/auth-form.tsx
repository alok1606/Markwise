import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Eye, EyeOff, Gavel, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AksWordmark } from '@/components/aks-wordmark';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brand } from './brand';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useAuth } from './auth-provider';
import { credentialsSchema } from '@/lib/access';

const judgeDemoAccounts = [
  { role: 'Creator', email: 'salok3191+judge.creator@gmail.com', password: 'Jd!5dc512244d084531a284e344def5c756x', tone: 'border-blue-200 bg-blue-50 text-blue-800' },
  { role: 'Manager', email: 'salok3191+judge.manager@gmail.com', password: 'Jd!6398f0c556f64ff58414c04540bd760bx', tone: 'border-violet-200 bg-violet-50 text-violet-800' },
  { role: 'Reviewer', email: 'salok3191+judge.reviewer@gmail.com', password: 'Jd!7b4a44c21592421281b23c51e3de5b02x', tone: 'border-teal-200 bg-teal-50 text-teal-800' },
  { role: 'Admin', email: 'salok3191+judge.admin@gmail.com', password: 'Jd!232ce6444a354edd95aa88d8351cb005x', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
] as const;

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
  async function signInWithGoogle() { setBusy(true); setError(''); try { const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin }); if (result.error) throw result.error; } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed'); } finally { setBusy(false); } }
  return <div className="min-h-screen bg-background"><header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7"><Link to="/"><Brand /></Link><Button asChild variant="ghost"><Link to="/">Back to home <ArrowRight /></Link></Button></header><main className="mx-auto max-w-md px-6 pb-16 pt-14"><p className="mb-4 text-xs font-semibold uppercase text-primary">Your brand. In good hands.</p><h1 className="text-3xl font-semibold">{title}</h1><p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">{mode === 'signup' ? 'A considered space for your team and your brand.' : mode === 'login' ? 'Sign in to your Markwise workspace.' : 'Keep your account secure with a new password.'}</p>
    {mode === 'signup' && <p role="note" className="mb-8 rounded-lg border border-primary/25 bg-accent/60 p-4 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">CodeNexus India 2026 judges:</span> you don&rsquo;t need to create an account. Sign in through the <Link to="/auth" className="font-medium text-primary underline underline-offset-2">Judge Demo Access section</Link> on the sign-in page using your demo accounts.</p>}
    {mode === 'login' && <section aria-label="Hackathon judge demo access" className="mb-8 rounded-lg border border-primary/25 bg-accent/60 p-5">
      <div className="flex items-center gap-2"><Gavel className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Hackathon Judges — Demo Access</h2></div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Welcome, CodeNexus India 2026 judges! Explore Markwise using our dedicated Judge Demo environment.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{['Creator', 'Manager', 'Reviewer', 'Admin'].map(r => <span key={r} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium">{r}</span>)}</div>
      <p className="mt-3 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">Demo Workspace: <span className="font-medium text-foreground">Judge Demo — <AksWordmark compact /></span></p>
      <div className="mt-4 space-y-2.5" aria-label="Judge evaluation sign-in credentials">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Evaluation sign-in credentials</p>
        {judgeDemoAccounts.map(({ role, email, password, tone }) => <div key={role} className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-3"><span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>{role}</span><span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Demo account</span></div>
          <dl className="mt-2 grid gap-1.5 text-xs sm:grid-cols-[4.25rem_minmax(0,1fr)] sm:gap-x-2">
            <dt className="font-medium text-muted-foreground">Email</dt><dd className="min-w-0 break-all font-medium text-foreground">{email}</dd>
            <dt className="font-medium text-muted-foreground">Password</dt><dd className="min-w-0 break-all font-mono text-foreground">{password}</dd>
          </dl>
        </div>)}
      </div>
      <p role="note" className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><span className="font-semibold">Evaluation use only.</span> These demo credentials are shown here only for evaluation and access an isolated demo workspace. Do not use them for personal or production accounts.</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Each role provides a different view of Markwise&rsquo;s brand governance and approval workflow.</p>
      <p className="mt-3 border-t border-border/60 pt-3 text-[11px] leading-5 text-muted-foreground"><span className="font-medium text-foreground">Temporary evaluation accounts.</span> These demo accounts are provided exclusively for CodeNexus India 2026 evaluation purposes and will be rotated or deactivated after the evaluation period ends.</p>
    </section>}
    {(mode === 'login' || mode === 'signup') && <><Button className="w-full" variant="outline" disabled={busy} onClick={signInWithGoogle}>Continue with Google</Button><div className="my-6 flex items-center gap-4 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with email<span className="h-px flex-1 bg-border" /></div></>}
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
