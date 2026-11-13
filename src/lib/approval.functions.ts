// Phase 6 server functions: finding actions, approval routing/decisions, comments, reviewer queue.
// Every rule is enforced again in the database functions; these wrappers authenticate, prepare text and trigger rechecking.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { applyRewrite } from './approval';
import { transformDocumentBlocks, type OfficeTextBlock } from './office-documents';
import { aiReview, executeChecks } from './content.functions';
import { readAdminReviews } from './admin-reviews';

type Ctx = { supabase: any; userId: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
const idInput = z.object({ workspace_id: z.string().uuid(), id: z.string().uuid() });
function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }
async function hasRole(ctx: Ctx, ws: string, role: string) {
  const r = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: role, _workspace_id: ws }); return !!r.data && !r.error;
}

export const actOnFinding = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(idInput.extend({ expected_version: z.number().int().positive(), finding_id: z.string().uuid(), action: z.enum(['accepted', 'edited', 'dismissed']), reason: z.string().max(1000).nullable().default(null), final_text: z.string().max(2000).nullable().default(null) }))
  .handler(async ({ data, context }) => {
    if (!(await hasRole(context, data.workspace_id, 'creator'))) throw new Error('Only the content owner can act on findings');
    // Read as the caller (RLS proves access) before any privileged step.
    const row = await context.supabase.from('contents').select('id,owner_id,status,version,body_text,type').eq('id', data.id).eq('workspace_id', data.workspace_id).maybeSingle();
    if (row.error || !row.data || row.data.owner_id !== context.userId) throw new Error('Content not found in this workspace');
    let newBody: string | null = null; let finalText: string | null = null;
    if (data.action !== 'dismissed') {
      const f = await context.supabase.from('findings').select('id,span_start,span_end,quoted_text,suggested_text').eq('id', data.finding_id).eq('content_id', data.id).maybeSingle();
      if (f.error || !f.data) throw new Error('Finding not found');
      finalText = data.action === 'accepted' ? f.data.suggested_text : data.final_text;
      if (finalText === null || finalText === undefined) throw new Error(data.action === 'accepted' ? 'This finding has no suggested rewrite' : 'Enter the replacement text');
      newBody = applyRewrite(row.data.body_text, f.data, finalText);
    }
    let documentMap: OfficeTextBlock[] | null = null;
    if (data.action !== 'dismissed' && (row.data.type === 'docx' || row.data.type === 'pptx')) {
      const oldVersion = await context.supabase.from('content_versions').select('id').eq('content_id', data.id)
        .eq('workspace_id', data.workspace_id).eq('version_number', data.expected_version).maybeSingle();
      if (oldVersion.error || !oldVersion.data) throw new Error('The reviewed document version could not be loaded');
      const map = await context.supabase.from('content_document_maps').select('blocks')
        .eq('workspace_id', data.workspace_id).eq('content_version_id', oldVersion.data.id).maybeSingle();
      if (map.error) throw new Error('The reviewed document locations could not be loaded');
      if (map.data?.blocks) documentMap = transformDocumentBlocks(map.data.blocks as OfficeTextBlock[], row.data.body_text, newBody!);
    }
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const r = await supabaseAdmin.rpc('act_on_finding', { _actor: context.userId, _content_id: data.id, _expected_version: data.expected_version, _finding_id: data.finding_id, _action: data.action,
      _reason: data.reason as string, _final_text: finalText as string, _new_body: newBody as string });
    fail(r.error);
    if (data.action === 'dismissed') return { version: r.data as number, checks: null, check_error: null, ai: null, ai_error: null };
    let document_map_error: string | null = null;
    if (documentMap) {
      const newVersion = await context.supabase.from('content_versions').select('id').eq('content_id', data.id)
        .eq('workspace_id', data.workspace_id).eq('version_number', r.data as number).maybeSingle();
      if (newVersion.error || !newVersion.data) document_map_error = 'The new document version was saved, but its paragraph and slide locations could not be loaded.';
      else {
        const savedMap = await supabaseAdmin.rpc('set_content_document_map', {
          _actor: context.userId, _content_id: data.id, _content_version_id: newVersion.data.id, _blocks: documentMap as never,
        });
        if (savedMap.error) document_map_error = 'The new document version was saved, but its paragraph and slide locations could not be retained.';
      }
    }
    // A new version was created: recheck it with the existing Phase 4 checks and Phase 5 AI review.
    let checks = null; let check_error: string | null = null; let ai = null; let ai_error: string | null = null;
    try { checks = await executeChecks(context, data.workspace_id, data.id, null, null); } catch (e) { check_error = e instanceof Error ? e.message : 'Automatic checks failed'; }
    try { ai = await aiReview(context, data.workspace_id, data.id); } catch (e) { ai_error = e instanceof Error ? e.message : 'AI review failed'; }
    return { version: r.data as number, checks, check_error, ai, ai_error, document_map_error };
  });

export const submitForApproval = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(idInput.extend({ expected_version: z.number().int().positive(), reviewer_id: z.string().uuid().nullable().default(null) }))
  .handler(async ({ data, context }) => {
    if (!(await hasRole(context, data.workspace_id, 'creator'))) throw new Error('Only the content owner can send for approval');
    const r = await context.supabase.rpc('submit_for_approval', { _content_id: data.id, _expected_version: data.expected_version, _reviewer_id: data.reviewer_id as string });
    fail(r.error); return { approval_id: r.data as string };
  });

export const decideApproval = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(idInput.extend({ approval_id: z.string().uuid(), expected_version: z.number().int().positive(), decision: z.enum(['approved', 'changes_requested', 'rejected']), comment: z.string().max(4000).default('') }))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc('decide_approval', { _approval_id: data.approval_id, _expected_version: data.expected_version, _decision: data.decision, _comment: data.comment });
    fail(r.error); return { ok: true };
  });

export const addComment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(idInput.extend({ parent_id: z.string().uuid().nullable().default(null), message: z.string().trim().min(1).max(4000) }))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc('add_comment', { _content_id: data.id, _parent_id: data.parent_id as string, _message: data.message });
    fail(r.error); return { id: r.data as string };
  });

/** Reviewers of this workspace, for the owner's reviewer picker. Names only; the database re-validates the choice. */
export const listWorkspaceReviewers = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ workspace_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await hasRole(context, data.workspace_id, 'creator'))) throw new Error('Only creators choose reviewers');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const roles = await supabaseAdmin.from('user_roles').select('user_id').eq('workspace_id', data.workspace_id).eq('role', 'reviewer');
    fail(roles.error);
    const ids = (roles.data ?? []).map(r => r.user_id).filter(id => id !== context.userId);
    if (!ids.length) return [];
    const p = await supabaseAdmin.from('profiles').select('id,full_name,email').in('id', ids);
    fail(p.error);
    return (p.data ?? []).map(x => ({ id: x.id, name: x.full_name || x.email })).sort((a, b) => a.name.localeCompare(b.name));
  });

/** Items assigned to the signed-in reviewer in this workspace (open first), read under RLS. */
export const listAdminReviews = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ workspace_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await hasRole(context, data.workspace_id, 'admin'))) throw new Error('Workspace administrator access required');
    return readAdminReviews(context.supabase, data.workspace_id);
  });

export const listReviewQueue = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ workspace_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await hasRole(context, data.workspace_id, 'reviewer'))) throw new Error('Only reviewers have a review queue');
    const a = await context.supabase.from('approvals').select('id,content_id,version_number,status,created_at,decided_at').eq('workspace_id', data.workspace_id).eq('reviewer_id', context.userId).order('created_at', { ascending: false });
    fail(a.error);
    const ids = [...new Set((a.data ?? []).map((x: { content_id: string }) => x.content_id))];
    if (!ids.length) return [];
    const c = await context.supabase.from('contents').select('id,title,type,channel,status,version,owner_id,updated_at').eq('workspace_id', data.workspace_id).in('id', ids);
    fail(c.error);
    const byId = new Map((c.data ?? []).map((x: { id: string }) => [x.id, x]));
    const seen = new Set<string>(); const out = [];
    for (const x of a.data ?? []) { if (seen.has(x.content_id) || !byId.has(x.content_id)) continue; seen.add(x.content_id); out.push({ ...(byId.get(x.content_id) as object), approval_status: x.status, assigned_at: x.created_at }); }
    return out as { id: string; title: string; type: 'text' | 'image' | 'pdf' | 'docx' | 'pptx'; channel: string; status: string; version: number; updated_at: string; approval_status: string; assigned_at: string }[];
  });
