import { z } from 'zod';

export const roleSchema = z.enum(['creator', 'manager', 'reviewer', 'admin']);
export type Role = z.infer<typeof roleSchema>;
export const roles = roleSchema.options;
export const profileSchema = z.object({ full_name: z.string().trim().min(1, 'Enter your name').max(100) });
export const credentialsSchema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(8, 'Use at least 8 characters') });
export function canManageUsers(role: Role) { return role === 'admin'; }
export const roleNavigation: Record<Role, string[]> = {
  creator: ['My Content', 'New Content'], manager: ['All Content'], reviewer: ['Review Queue'], admin: ['Reviews', 'Accuracy', 'Fact Impact', 'Knowledge Base', 'Users', 'AI Calls'],
};
export function meta(title: string, description: string) {
  return { meta: [{ title: `${title} · Markwise` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} · Markwise` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] };
}
