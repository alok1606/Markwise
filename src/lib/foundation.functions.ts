import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { profileSchema, roleSchema } from './access';

export const getAccess = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [profile, memberships] = await Promise.all([
    context.supabase.from('profiles').select('*').eq('id', context.userId).single(),
    context.supabase.from('user_roles').select('workspace_id,role,created_at,workspaces(id,name,created_by)').eq('user_id', context.userId),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  if (memberships.error) throw new Error(memberships.error.message);
  // Auth is authoritative for email; profiles.email is the original signup copy.
  const account = await context.supabase.auth.getUser();
  if (account.error || !account.data.user) throw new Error('Please sign in again');
  let avatar: string | null = null;
  if (profile.data.avatar_url) {
    const signed = await context.supabase.storage.from('avatars').createSignedUrl(profile.data.avatar_url, 3600);
    avatar = signed.data?.signedUrl ?? null;
  }
  return { profile: { ...profile.data, email: account.data.user.email ?? '' }, memberships: memberships.data, avatar };
});
const workspaceSchema = z.object({ workspace_id: z.string().uuid() });
export const getMembers = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(workspaceSchema).handler(async ({ data, context }) => {
  const check = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin', _workspace_id: data.workspace_id });
  if (check.error || !check.data) throw new Error('Only workspace administrators can view members');
  const members = await context.supabase.from('workspace_members').select('user_id,created_at,profiles(id,full_name,email),user_roles(role)').eq('workspace_id', data.workspace_id);
  if (members.error) throw new Error(members.error.message);
  return members.data.map(member => {
    const relation: unknown = member.user_roles;
    const roleRecord = Array.isArray(relation) ? relation[0] : relation;
    const parsed = roleSchema.safeParse((roleRecord as { role?: unknown } | null)?.role);
    if (!parsed.success) throw new Error('Member role unavailable');
    return { ...member, user_roles: [{ role: parsed.data }] };
  });
});
export const assignRole = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(workspaceSchema.extend({ user_id: z.string().uuid(), role: roleSchema })).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('manage_workspace_member', { _workspace_id: data.workspace_id, _user_id: data.user_id, _role: data.role });
  if (error) throw new Error(error.message);
});
export const addMember = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(workspaceSchema.extend({ email: z.string().trim().email(), role: roleSchema })).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('add_workspace_member_by_email', { _workspace_id: data.workspace_id, _email: data.email, _role: data.role });
  if (error) throw new Error(error.message);
});
export const saveProfile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(profileSchema.extend({ avatar_url: z.string().nullable() })).handler(async ({ data, context }) => {
  if (data.avatar_url && (!data.avatar_url.startsWith(`${context.userId}/`) || !/^[-\w/]+\.(png|jpg|jpeg|webp)$/.test(data.avatar_url))) throw new Error('Invalid avatar path');
  const { error } = await context.supabase.from('profiles').update(data).eq('id', context.userId);
  if (error) throw new Error(error.message);
});
export const saveWorkspace = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(workspaceSchema.extend({ name: z.string().trim().min(1).max(100) })).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('rename_workspace', { _workspace_id: data.workspace_id, _name: data.name });
  if (error) throw new Error(error.message);
});