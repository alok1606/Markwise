import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { AI_CALL_PAGE_SIZE, aiCallStatuses, cleanSearch, type AiCallRow } from './ai-calls';

const input = z.object({ workspace_id: z.string().uuid(), page: z.number().int().min(1).max(10_000).default(1), status: z.enum(aiCallStatuses).default('all'), q: z.string().max(200).default('') });

// Admin-only, workspace-scoped read of the immutable AI-call log. Runs as the caller, so the
// existing ai_calls RLS policy (Admin of that workspace) still applies underneath this check.
export const listAiCalls = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(input).handler(async ({ data, context }) => {
  const admin = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin', _workspace_id: data.workspace_id });
  if (admin.error || !admin.data) throw new Error('Only workspace administrators can view the AI call log');
  const from = (data.page - 1) * AI_CALL_PAGE_SIZE;
  let q = context.supabase.from('ai_calls').select('id,created_at,content_id,content_version_id,provider,model,prompt_version,status,error_kind,what_was_sent_summary', { count: 'exact' })
    .eq('workspace_id', data.workspace_id).order('created_at', { ascending: false }).order('id').range(from, from + AI_CALL_PAGE_SIZE - 1);
  if (data.status !== 'all') q = q.eq('status', data.status);
  const term = cleanSearch(data.q);
  if (term) {
    const like = `%${term}%`;
    const ors = [`model.ilike.${like}`, `provider.ilike.${like}`, `prompt_version.ilike.${like}`, `error_kind.ilike.${like}`, `what_was_sent_summary.ilike.${like}`];
    if (/^[0-9a-f-]{36}$/i.test(term)) ors.push(`content_id.eq.${term}`);
    q = q.or(ors.join(','));
  }
  const r = await q;
  if (r.error) throw new Error('The AI call log could not be loaded');
  return { rows: (r.data ?? []) as AiCallRow[], total: r.count ?? 0 };
});
