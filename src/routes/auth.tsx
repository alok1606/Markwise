import { createFileRoute } from '@tanstack/react-router';
import { AuthForm } from '@/components/auth-form';
import { meta } from '@/lib/access';
export const Route = createFileRoute('/auth')({ head: () => meta('Sign in', 'Sign in securely to your Markwise workspace.'), component: () => <AuthForm mode="login" /> });