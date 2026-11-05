import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { checkContentFile, contentFieldsSchema, contentPathPattern, contentTypes, fieldsForType, type ContentType } from './content';

type Ctx = { supabase: any; userId: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
const ws = z.object({ workspace_id: z.string().uuid() });
const idInput = ws.extend({ id: z.string().uuid() });

async function requireRole(ctx: Ctx, workspaceId: string, role: 'creator' | 'manager', message: string) {
  const { data, error } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: role, _workspace_id: workspaceId });
  if (error || !data) throw new Error(message);
}
async function contentRole(ctx: Ctx, workspaceId: string) {
  const [c, m] = await Promise.all(['creator', 'manager'].map(r => ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: r, _workspace_id: workspaceId })));
  if (c?.data) return 'creator'; if (m?.data) return 'manager';
  throw new Error('You do not have access to content in this workspace');
}
function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }
const listCols = 'id,title,type,channel,status,version,owner_id,created_at,updated_at,submitted_at';

export const listMyContent = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(ws).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators have personal content');
  const r = await context.supabase.from('contents').select(listCols).eq('workspace_id', data.workspace_id).eq('owner_id', context.userId).order('updated_at', { ascending: false });
  fail(r.error); return r.data ?? [];
});

export const listWorkspaceContent = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(ws).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'manager', 'Only managers can view all workspace content');
  const r = await context.supabase.from('contents').select(listCols).eq('workspace_id', data.workspace_id).neq('status', 'draft').order('submitted_at', { ascending: false });
  fail(r.error);
  const ids = [...new Set((r.data ?? []).map(c => c.owner_id))]; const names = new Map<string, string>();
  if (ids.length) { const p = await context.supabase.from('profiles').select('id,full_name,email').in('id', ids); for (const x of p.data ?? []) names.set(x.id, x.full_name || x.email); }
  return (r.data ?? []).map(c => ({ ...c, owner_name: names.get(c.owner_id) ?? 'Workspace member' }));
});

export const getContent = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(idInput).handler(async ({ data, context }) => {
  const role = await contentRole(context, data.workspace_id);
  const row = await context.supabase.from('contents').select('*').eq('id', data.id).eq('workspace_id', data.workspace_id).maybeSingle();
  if (row.error || !row.data) throw new Error('Content not found in this workspace');
  const c = row.data;
  const versions = await context.supabase.from('content_versions').select('id,version_number,title,body_text,file_name,file_path,alt_text,text_color,background_color,change_summary,changed_by,created_at').eq('content_id', c.id).order('version_number', { ascending: false });
  fail(versions.error);
  let file_url: string | null = null;
  if (c.file_path) { const s = await context.supabase.storage.from('content-files').createSignedUrl(c.file_path, 600); file_url = s.data?.signedUrl ?? null; }
  const owner = await context.supabase.from('profiles').select('full_name,email').eq('id', c.owner_id).maybeSingle();
  return { content: c, versions: versions.data ?? [], file_url, owner_name: owner.data?.full_name || owner.data?.email || 'Workspace member', is_owner: c.owner_id === context.userId && role === 'creator' };
});

export const getVersionFileUrl = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput.extend({ version_id: z.string().uuid() })).handler(async ({ data, context }) => {
  await contentRole(context, data.workspace_id);
  const v = await context.supabase.from('content_versions').select('file_path,file_name').eq('id', data.version_id).eq('content_id', data.id).eq('workspace_id', data.workspace_id).maybeSingle();
  if (v.error || !v.data?.file_path) throw new Error('File not found for this version');
  const s = await context.supabase.storage.from('content-files').createSignedUrl(v.data.file_path, 60, { download: v.data.file_name ?? true });
  if (s.error) throw new Error('Unable to prepare the download');
  return { url: s.data.signedUrl };
});

const fields = contentFieldsSchema;
export const createContent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(ws.extend({ type: z.enum(contentTypes), fields })).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators can create content');
  const f = fieldsForType(data.type, data.fields);
  const r = await context.supabase.rpc('create_content', { _workspace_id: data.workspace_id, _type: data.type, _title: f.title, _channel: f.channel, _audience: f.audience, _goal: f.goal,
    _body_text: data.type === 'text' ? f.body_text : '', _alt_text: f.alt_text as string, _text_color: f.text_color as string, _background_color: f.background_color as string });
  fail(r.error); return { id: r.data as string };
});

export const saveContentDraft = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput.extend({ expected_version: z.number().int().positive(), type: z.enum(contentTypes), fields, pdf_text_confirmed: z.boolean().default(false) })).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators can edit content');
  const f = fieldsForType(data.type, data.fields);
  const r = await context.supabase.rpc('save_content_draft', { _content_id: data.id, _expected_version: data.expected_version, _title: f.title, _channel: f.channel, _audience: f.audience, _goal: f.goal,
    _body_text: f.body_text, _alt_text: f.alt_text as string, _text_color: f.text_color as string, _background_color: f.background_color as string, _pdf_text_confirmed: data.pdf_text_confirmed });
  fail(r.error); return { version: r.data as number };
});

export const submitContent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput.extend({ expected_version: z.number().int().positive() })).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators can submit content');
  const r = await context.supabase.rpc('submit_content', { _content_id: data.id, _expected_version: data.expected_version }); fail(r.error);
});

export const deleteContentDraft = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators can delete drafts');
  const r = await context.supabase.rpc('delete_content_draft', { _content_id: data.id }); fail(r.error);
});

export const registerContentFile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput.extend({ expected_version: z.number().int().positive(), path: z.string().max(200), name: z.string().trim().min(1).max(200) })).handler(async ({ data, context }) => {
  await requireRole(context, data.workspace_id, 'creator', 'Only creators can upload content files');
  if (!contentPathPattern(data.workspace_id, data.id).test(data.path)) throw new Error('Invalid file location');
  // Read the content as the caller (RLS) to confirm ownership before any privileged step.
  const row = await context.supabase.from('contents').select('id,type,status,owner_id').eq('id', data.id).eq('workspace_id', data.workspace_id).maybeSingle();
  if (row.error || !row.data || row.data.owner_id !== context.userId) throw new Error('Content not found in this workspace');
  if (row.data.status !== 'draft') throw new Error('Submitted content cannot be edited');
  if (row.data.type === 'text') throw new Error('Text content has no file');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const discard = async () => { await supabaseAdmin.storage.from('content-files').remove([data.path]); };
  const file = await context.supabase.storage.from('content-files').download(data.path);
  if (file.error || !file.data) throw new Error('Upload not found; please try again');
  const buf = new Uint8Array(await file.data.arrayBuffer());
  const ext = data.path.split('.').pop() ?? '';
  const problem = checkContentFile(row.data.type as Exclude<ContentType, 'text'>, buf.subarray(0, 16), buf.byteLength, ext);
  if (problem) { await discard(); throw new Error(problem); }
  const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' }[ext]!;
  const r = await supabaseAdmin.rpc('set_content_file', { _actor: context.userId, _content_id: data.id, _expected_version: data.expected_version, _file_path: data.path, _file_name: data.name, _file_mime: mime, _file_size: buf.byteLength });
  if (r.error) { await discard(); throw new Error(r.error.message); }
  return { version: r.data as number };
});
