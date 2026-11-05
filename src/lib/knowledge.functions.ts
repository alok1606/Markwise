import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { assetCategories, brandProfileSchema, entitySchemas, fileRules, storagePathPattern, type Entity, type FileKind } from './knowledge';

type Ctx = { supabase: any; userId: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
const ws = z.object({ workspace_id: z.string().uuid() });
const entity = z.enum(['rules', 'facts', 'glossary', 'palette', 'brand_fonts']);
const fileKind = z.enum(['document', 'asset']);
const fileTable = { document: 'brand_documents', asset: 'brand_assets' } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untyped = (ctx: Ctx): any => ctx.supabase; // dynamic table names; inputs are zod-validated and RLS still applies

// Server-side admin check gives clear errors; RLS enforces the same rule underneath.
async function requireAdmin(ctx: Ctx, workspaceId: string) {
  const { data, error } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'admin', _workspace_id: workspaceId });
  if (error || !data) throw new Error('Only workspace administrators can manage the knowledge base');
}
function fail(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === '23505') throw new Error('That code or name is already used in this workspace');
  throw new Error(error.message);
}

export const getKnowledge = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(ws).handler(async ({ data, context }) => {
  await requireAdmin(context, data.workspace_id);
  const db = context.supabase; const id = data.workspace_id;
  const [profile, documents, rules, facts, glossary, palette, fonts, assets] = await Promise.all([
    db.from('brand_profiles').select('*').eq('workspace_id', id).maybeSingle(),
    db.from('brand_documents').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
    db.from('rules').select('*').eq('workspace_id', id).order('code'),
    db.from('facts').select('*').eq('workspace_id', id).order('code'),
    db.from('glossary').select('*').eq('workspace_id', id).order('preferred_term'),
    db.from('palette').select('*').eq('workspace_id', id).order('created_at'),
    db.from('brand_fonts').select('*').eq('workspace_id', id).order('name'),
    db.from('brand_assets').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
  ]);
  for (const r of [profile, documents, rules, facts, glossary, palette, fonts, assets]) fail(r.error);
  const assetRows = assets.data ?? []; const factRows = facts.data ?? [];
  const previews = new Map<string, string>();
  if (assetRows.length) {
    const signed = await db.storage.from('brand-assets').createSignedUrls(assetRows.map(a => a.file_path), 3600);
    for (const s of signed.data ?? []) if (s.path && s.signedUrl) previews.set(s.path, s.signedUrl);
  }
  const approverIds = [...new Set(factRows.map(f => f.approved_by).filter((v): v is string => !!v))];
  const approvers = new Map<string, string>();
  if (approverIds.length) {
    const people = await db.from('profiles').select('id,full_name,email').in('id', approverIds);
    for (const p of people.data ?? []) approvers.set(p.id, p.full_name || p.email);
  }
  return {
    profile: profile.data, documents: documents.data ?? [], rules: rules.data ?? [],
    facts: factRows.map(f => ({ ...f, approver_name: f.approved_by ? approvers.get(f.approved_by) ?? 'Former member' : null })), glossary: glossary.data ?? [],
    palette: palette.data ?? [], fonts: fonts.data ?? [], assets: assetRows.map(a => ({ ...a, preview_url: previews.get(a.file_path) ?? null })),
  };
});

export const saveBrandProfile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(ws.extend({ profile: brandProfileSchema })).handler(async ({ data, context }) => {
  await requireAdmin(context, data.workspace_id);
  // An edited profile belongs to the workspace, so demo removal must never delete it.
  const { error } = await context.supabase.from('brand_profiles').upsert({ workspace_id: data.workspace_id, ...data.profile, is_demo: false, updated_by: context.userId });
  fail(error);
});

const saveInput = ws.extend({ entity, id: z.string().uuid().optional(), values: z.record(z.string(), z.unknown()) });
export const saveRecord = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(saveInput).handler(async ({ data, context }) => {
  await requireAdmin(context, data.workspace_id);
  const parsed = entitySchemas[data.entity as Entity].safeParse(data.values);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
  const table = untyped(context).from(data.entity);
  const result = data.id
    ? await table.update(parsed.data).eq('id', data.id).eq('workspace_id', data.workspace_id).select('id')
    : await table.insert({ ...parsed.data, workspace_id: data.workspace_id }).select('id');
  fail(result.error);
  if (!result.data?.length) throw new Error('Record not found in this workspace');
});

export const setRuleActive = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(ws.extend({ id: z.string().uuid(), active: z.boolean() })).handler(async ({ data, context }) => {
  await requireAdmin(context, data.workspace_id);
  const { data: rows, error } = await context.supabase.from('rules').update({ active: data.active }).eq('id', data.id).eq('workspace_id', data.workspace_id).select('id');
  fail(error); if (!rows?.length) throw new Error('Rule not found in this workspace');
});

export const deleteRecord = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(ws.extend({ entity: z.union([entity, fileKind]), id: z.string().uuid() })).handler(async ({ data, context }) => {
  await requireAdmin(context, data.workspace_id);
  if (data.entity === 'document' || data.entity === 'asset') {
    const kind = data.entity as FileKind;
    const { data: rows, error } = await untyped(context).from(fileTable[kind]).delete().eq('id', data.id).eq('workspace_id', data.workspace_id).select('file_path');
    fail(error); if (!rows?.length) throw new Error('File not found in this workspace');
    await context.supabase.storage.from(fileRules[kind].bucket).remove([String(rows[0]?.file_path)]);
    return;
  }
  const { data: rows, error } = await untyped(context).from(data.entity).delete().eq('id', data.id).eq('workspace_id', data.workspace_id).select('id');
  fail(error); if (!rows?.length) throw new Error('Record not found in this workspace');
});

const registerInput = ws.extend({ kind: fileKind, replace_id: z.string().uuid().optional(), name: z.string().trim().min(1).max(200), path: z.string().max(200), category: z.enum(assetCategories).optional() });
export const registerFile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(registerInput).handler(async ({ data, context }) => {
  await requireAdmin(context, data.workspace_id);
  const rule = fileRules[data.kind]; const bucket = context.supabase.storage.from(rule.bucket);
  const discard = async () => { await bucket.remove([data.path]); };
  if (!storagePathPattern(data.kind, data.workspace_id).test(data.path)) throw new Error('Invalid file location');
  // Trust the stored object's metadata, not the browser's claims.
  const fileName = data.path.split('/')[1] ?? '';
  const listed = await bucket.list(data.workspace_id, { search: fileName, limit: 5 });
  const object = listed.data?.find(o => o.name === fileName);
  const meta = (object?.metadata ?? {}) as { size?: number; mimetype?: string };
  const ext = fileName.split('.').pop() ?? '';
  const mime = meta.mimetype && rule.types[meta.mimetype] ? meta.mimetype : Object.keys(rule.types).find(t => rule.types[t] === ext) ?? '';
  if (!object || !meta.size) throw new Error('Upload not found; please try again');
  const declaredOk = !meta.mimetype || meta.mimetype === 'application/octet-stream' || !!rule.types[meta.mimetype];
  if (meta.size > rule.maxBytes || !rule.types[mime] || !declaredOk) { await discard(); throw new Error(`Unsupported file. Use ${rule.label}.`); }
  const table = untyped(context).from(fileTable[data.kind]);
  const values = { name: data.name, file_path: data.path, mime_type: mime, size_bytes: meta.size, uploaded_by: context.userId, ...(data.kind === 'asset' ? { category: data.category ?? 'other' } : {}) };
  if (data.replace_id) {
    const old = await untyped(context).from(fileTable[data.kind]).select('file_path').eq('id', data.replace_id).eq('workspace_id', data.workspace_id).maybeSingle();
    if (old.error || !old.data) { await discard(); throw new Error('File to replace was not found in this workspace'); }
    const updated = await table.update(values).eq('id', data.replace_id).eq('workspace_id', data.workspace_id);
    if (updated.error) { await discard(); fail(updated.error); }
    await bucket.remove([old.data.file_path]);
  } else {
    const inserted = await table.insert({ ...values, workspace_id: data.workspace_id });
    if (inserted.error) { await discard(); fail(inserted.error); }
  }
});

export const getFileUrl = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(ws.extend({ kind: fileKind, id: z.string().uuid() })).handler(async ({ data, context }) => {
  await requireAdmin(context, data.workspace_id);
  const row = await untyped(context).from(fileTable[data.kind]).select('file_path,name').eq('id', data.id).eq('workspace_id', data.workspace_id).maybeSingle();
  if (row.error || !row.data) throw new Error('File not found in this workspace');
  const signed = await context.supabase.storage.from(fileRules[data.kind].bucket).createSignedUrl(row.data.file_path, 60, { download: row.data.name });
  if (signed.error) throw new Error('Unable to prepare the download');
  return { url: signed.data.signedUrl };
});

export const getHistory = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(ws.extend({ entity: z.enum(['rules', 'facts']), id: z.string().uuid() })).handler(async ({ data, context }) => {
  await requireAdmin(context, data.workspace_id);
  const table = data.entity === 'rules' ? 'rule_history' : 'fact_history'; const key = data.entity === 'rules' ? 'rule_id' : 'fact_id';
  const { data: rows, error } = await untyped(context).from(table).select('id,version,change,snapshot,changed_at').eq(key, data.id).eq('workspace_id', data.workspace_id).order('version', { ascending: false }).limit(50);
  fail(error);
  type H = { id: string; version: number; change: string; snapshot: Record<string, unknown>; changed_at: string };
  return ((rows ?? []) as H[]).map(h => ({ id: h.id, version: h.version, change: h.change, changed_at: h.changed_at,
    summary: [h.snapshot['title'], h.snapshot['statement']].filter(Boolean).map(String).join(' — ') + (h.snapshot['status'] ? ` (${String(h.snapshot['status'])})` : '') }));
});

export const setDemoKnowledge = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(ws.extend({ load: z.boolean() })).handler(async ({ data, context }) => {
  await requireAdmin(context, data.workspace_id);
  const { error } = await context.supabase.rpc(data.load ? 'load_demo_knowledge' : 'remove_demo_knowledge', { _workspace_id: data.workspace_id });
  fail(error);
});
