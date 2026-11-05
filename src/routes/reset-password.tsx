import { createFileRoute } from '@tanstack/react-router';
import { AuthForm } from '@/components/auth-form';
import { meta } from '@/lib/access';
export const Route = createFileRoute('/reset-password')({ head: () => meta('Reset password', 'Set a new password for your Markwise account.'), component: () => <AuthForm mode="reset" /> });