import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { buildFactChanges, findFactImpacts, type ContentVersionForImpact, type FactCitation, type FactHistorySnapshot, type FactSnapshot } from './fact-impact';

type Context = { supabase: any; userId: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
const workspaceInput = z.object({ workspace_id: z.string().uuid() });
const db = (context: Context) => context.supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function assertFactImpactAdmin(context: Context, workspaceId: string) {
  const { data, error } = await db(context).rpc('has_role', { _user_id: context.userId, _role: 'admin', _workspace_id: workspaceId });
  if (error || data !== true) throw new Error('Only an administrator of this workspace can view fact impact scans');
}

async function allRows(query: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let from = 0; ; from += 500) {
    const { data, error } = await query.range(from, from + 499);
    if (error) throw new Error('Fact impact data could not be loaded. Check workspace access and retry.');
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

/** Read-only scan over existing fact snapshots, saved content versions and verified review citations. */
export const getFactImpactScan = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(workspaceInput).handler(async ({ data, context }) => {
  const ctx = context as Context;
  await assertFactImpactAdmin(ctx, data.workspace_id);
  const client = db(ctx); const workspaceId = data.workspace_id;
  const [facts, history, versions, reviews, findings, contents] = await Promise.all([
    allRows(client.from('facts').select('id,workspace_id,code,title,statement,active,status,version,created_at').eq('workspace_id', workspaceId).order('id')),
    allRows(client.from('fact_history').select('fact_id,workspace_id,version,change,snapshot,changed_at').eq('workspace_id', workspaceId).order('id')),
    allRows(client.from('content_versions').select('id,content_id,workspace_id,version_number,title,body_text,alt_text,created_at').eq('workspace_id', workspaceId).order('id')),
    allRows(client.from('reviews').select('id,content_id,content_version_id,workspace_id').eq('workspace_id', workspaceId).order('id')),
    allRows(client.from('findings').select('id,review_id,content_id,workspace_id,cited_kind,cited_id,cited_code,cited_passage').eq('workspace_id', workspaceId).eq('cited_kind', 'fact').not('cited_id', 'is', null).order('id')),
    allRows(client.from('contents').select('id,workspace_id,status,owner_id,version,updated_at').eq('workspace_id', workspaceId).order('id')),
  ]);
  const reviewById = new Map(reviews.filter((row: { workspace_id: string }) => row.workspace_id === workspaceId).map((row: { id: string; content_id: string; content_version_id: string }) => [row.id, row]));
  const citations: FactCitation[] = findings.flatMap((row: { workspace_id: string; review_id: string; content_id: string; cited_id: string; cited_code: string | null; cited_passage: string | null }) => {
    const review = reviewById.get(row.review_id);
    if (!review || review.content_id !== row.content_id || !row.cited_id) return [];
    return [{ workspace_id: workspaceId, content_id: row.content_id, content_version_id: review.content_version_id, fact_id: row.cited_id, cited_code: row.cited_code ?? '', cited_passage: row.cited_passage ?? '' }];
  });
  const changes = buildFactChanges(workspaceId, facts as FactSnapshot[], history as FactHistorySnapshot[]);
  const impacts = findFactImpacts(workspaceId, changes, versions as ContentVersionForImpact[], citations);
  const contentById = new Map(contents.map((row: { id: string; status: string; version: number; owner_id: string; updated_at: string }) => [row.id, row]));
  return { changes, impacts: impacts.map(impact => ({ ...impact, content: contentById.get(impact.content_id) ?? null })), scanned_at: new Date().toISOString() };
});
