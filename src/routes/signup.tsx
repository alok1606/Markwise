import { createFileRoute } from '@tanstack/react-router';
import { AuthForm } from '@/components/auth-form';
import { meta } from '@/lib/access';
export const Route = createFileRoute('/signup')({ head: () => meta('Create account', 'Create your Markwise account and private workspace.'), component: () => <AuthForm mode="signup" /> });