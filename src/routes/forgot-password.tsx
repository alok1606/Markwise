import { createFileRoute } from '@tanstack/react-router';
import { AuthForm } from '@/components/auth-form';
import { meta } from '@/lib/access';
export const Route = createFileRoute('/forgot-password')({ head: () => meta('Password recovery', 'Request a secure password reset link for Markwise.'), component: () => <AuthForm mode="forgot" /> });