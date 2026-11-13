import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';
import { evaluateObservations, type EvaluationObservation } from './accuracy-evaluation';
import { ACCURACY_CASES, aiSourcesForCase, type AccuracyCase } from './accuracy-dataset';
import { AI_MODEL, AI_PROMPT_VERSION, EVALUATOR_VERSION, ACCURACY_DATASET_VERSION, executeAccuracyCase } from './accuracy-evaluator.server';

type Ctx = { supabase: any; userId: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
const workspaceInput = z.object({ workspace_id: z.string().uuid() });
const runInput = workspaceInput.extend({ run_id: z.string().uuid() });
const RUN_TABLE = 'accuracy_evaluation_runs';
const RESULT_TABLE = 'accuracy_evaluation_results';
const MAX_AI_CALLS_PER_RUN = 300;
const MAX_AI_CALLS_PER_BATCH = 25;
const BATCH_CASES = 2;
const AI_CALLS_PER_CASE = 2;

export async function assertAccuracyAdmin(ctx: Ctx, workspaceId: string) {
  const role = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'admin', _workspace_id: workspaceId });
  if (role.error || role.data !== true) throw new Error('Workspace administrator access required');
}

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
async function datasetHash() {
  const snapshot = ACCURACY_CASES.map(testCase => ({ ...testCase, ai_sources: aiSourcesForCase(testCase) }));
  const bytes = new TextEncoder().encode(stableJson(snapshot));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export const listAccuracyRuns = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator(workspaceInput).handler(async ({ data, context }) => {
    await assertAccuracyAdmin(context, data.workspace_id);
    const rows = await context.supabase.from(RUN_TABLE).select('*').eq('workspace_id', data.workspace_id).order('created_at', { ascending: false }).limit(25);
    fail(rows.error); return rows.data ?? [];
  });

export const getAccuracyRun = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator(runInput).handler(async ({ data, context }) => {
    await assertAccuracyAdmin(context, data.workspace_id);
    const [run, results] = await Promise.all([
      context.supabase.from(RUN_TABLE).select('*').eq('id', data.run_id).eq('workspace_id', data.workspace_id).maybeSingle(),
      context.supabase.from(RESULT_TABLE).select('*').eq('run_id', data.run_id).eq('workspace_id', data.workspace_id).order('created_at'),
    ]);
    if (run.error || !run.data) throw new Error('Evaluation run not found in this workspace');
    fail(results.error); return { run: run.data, results: results.data ?? [] };
  });

export const createAccuracyRun = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(workspaceInput).handler(async ({ data, context }) => {
    await assertAccuracyAdmin(context, data.workspace_id);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const existing = await supabaseAdmin.from(RUN_TABLE).select('*').eq('workspace_id', data.workspace_id).in('status', ['queued', 'running']).maybeSingle();
    fail(existing.error); if (existing.data) return existing.data;
    if (ACCURACY_CASES.length * AI_CALLS_PER_CASE > MAX_AI_CALLS_PER_RUN) throw new Error('The guided and unguided evaluation exceeds the 300-call safety limit');
    const inserted = await supabaseAdmin.from(RUN_TABLE).insert({
      workspace_id: data.workspace_id, requested_by: context.userId, dataset_version: ACCURACY_DATASET_VERSION,
      dataset_sha256: await datasetHash(), evaluator_version: EVALUATOR_VERSION, model: AI_MODEL,
      prompt_version: AI_PROMPT_VERSION, as_of_date: new Date().toISOString().slice(0, 10),
      status: 'queued', total_cases: ACCURACY_CASES.length,
    }).select('*').single();
    if (inserted.error?.code === '23505') {
      const active = await supabaseAdmin.from(RUN_TABLE).select('*').eq('workspace_id', data.workspace_id).in('status', ['queued', 'running']).maybeSingle();
      fail(active.error); if (active.data) return active.data;
    }
    fail(inserted.error); return inserted.data;
  });

export const processAccuracyBatch = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(runInput).handler(async ({ data, context }) => {
    await assertAccuracyAdmin(context, data.workspace_id);
    // RLS is exercised with the caller's workspace-scoped session before service-role writes begin.
    const visible = await context.supabase.from(RUN_TABLE).select('id,status,workspace_id,started_at').eq('id', data.run_id).eq('workspace_id', data.workspace_id).maybeSingle();
    if (visible.error || !visible.data) throw new Error('Evaluation run not found in this workspace');
    if (['completed', 'partial', 'failed'].includes(visible.data.status)) return { run_id: data.run_id, locked: false, terminal: true };

    const now = new Date(); const token = crypto.randomUUID();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const claimed = await supabaseAdmin.from(RUN_TABLE).update({
      status: 'running', batch_lease_token: token,
      lease_expires_at: new Date(now.getTime() + 5 * 60_000).toISOString(), started_at: visible.data.started_at ?? now.toISOString(),
    }).eq('id', data.run_id).eq('workspace_id', data.workspace_id).in('status', ['queued', 'running'])
      .or(`lease_expires_at.is.null,lease_expires_at.lt.${now.toISOString()}`).select('id').maybeSingle();
    fail(claimed.error);
    if (!claimed.data) return { run_id: data.run_id, locked: true, terminal: false };

    try {
      const runResult = await supabaseAdmin.from(RUN_TABLE).select('*').eq('id', data.run_id).eq('workspace_id', data.workspace_id).single();
      if (runResult.error || !runResult.data) throw new Error('Evaluation run not found in this workspace');
      const run = runResult.data;
      const stored = await supabaseAdmin.from(RESULT_TABLE).select('*').eq('run_id', data.run_id).eq('workspace_id', data.workspace_id);
      fail(stored.error);
      const completedKeys = new Set((stored.data ?? []).map(row => row.case_key));
      const nextCases = ACCURACY_CASES.filter(testCase => !completedKeys.has(testCase.id)).slice(0, BATCH_CASES);
      if (run.ai_calls + nextCases.length * AI_CALLS_PER_CASE > MAX_AI_CALLS_PER_RUN || nextCases.length * AI_CALLS_PER_CASE > MAX_AI_CALLS_PER_BATCH) {
        throw new Error('The evaluation reached the configured AI call safety limit');
      }
      let reservedCalls = 0;
      for (const testCase of nextCases) {
        const execution = await executeAccuracyCase(testCase, { asOfDate: run.as_of_date, beforeAiCall: async () => {
          const reserved = await supabaseAdmin.from(RUN_TABLE).update({ ai_calls: run.ai_calls + reservedCalls + 1 })
            .eq('id', data.run_id).eq('workspace_id', data.workspace_id).eq('batch_lease_token', token)
            .eq('ai_calls', run.ai_calls + reservedCalls).lt('ai_calls', MAX_AI_CALLS_PER_RUN).select('id').maybeSingle();
          fail(reserved.error);
          if (!reserved.data) throw new Error('The evaluation reached the configured AI call safety limit or lost its processing lease');
          reservedCalls++;
        } });
        const inserted = await supabaseAdmin.from(RESULT_TABLE).insert({ ...execution, run_id: data.run_id, workspace_id: data.workspace_id,
          expected_deterministic: execution.expected_deterministic as unknown as Json,
          predicted_deterministic: execution.predicted_deterministic as unknown as Json,
          expected_ai: execution.expected_ai as unknown as Json,
          predicted_ai: execution.predicted_ai as unknown as Json | null,
        });
        if (inserted.error) throw new Error('A case result could not be saved; completed results remain preserved');
      }

      const allResults = await supabaseAdmin.from(RESULT_TABLE).select('*').eq('run_id', data.run_id).eq('workspace_id', data.workspace_id);
      fail(allResults.error);
      const observations: EvaluationObservation[] = (allResults.data ?? []).map(row => ({
        case_id: row.case_key, title: row.case_title,
        deterministic_expected: row.expected_deterministic as unknown as EvaluationObservation['deterministic_expected'],
        deterministic_predicted: row.predicted_deterministic as unknown as EvaluationObservation['deterministic_predicted'],
        ai_expected: row.expected_ai as unknown as EvaluationObservation['ai_expected'],
        ai_predicted: row.ai_status === 'completed' ? row.predicted_ai as unknown as NonNullable<EvaluationObservation['ai_predicted']> : null,
        unguided_ai_predicted: row.unguided_ai_status === 'completed' ? row.predicted_ai_unguided as unknown as NonNullable<EvaluationObservation['unguided_ai_predicted']> : null,
      }));
      const metrics = evaluateObservations(observations);
      const complete = allResults.data?.length === ACCURACY_CASES.length;
      const aiFailures = allResults.data?.filter(row => row.ai_status === 'failed' || row.unguided_ai_status === 'failed').length ?? 0;
      const status = complete ? (aiFailures ? 'partial' : 'completed') : 'running';
      const updated = await supabaseAdmin.from(RUN_TABLE).update({
        completed_cases: allResults.data?.length ?? 0,
        metrics: metrics as unknown as Json, status, error_summary: aiFailures ? `${aiFailures} AI case(s) failed validation or service checks; deterministic results remain available.` : null,
        completed_at: complete ? new Date().toISOString() : null,
        batch_lease_token: complete ? null : token,
        lease_expires_at: complete ? null : new Date(Date.now() + 5 * 60_000).toISOString(),
      }).eq('id', data.run_id).eq('workspace_id', data.workspace_id).eq('batch_lease_token', token).select('id').single();
      fail(updated.error);
      return { run_id: data.run_id, locked: false, terminal: complete, status, completed_cases: allResults.data?.length ?? 0, total_cases: ACCURACY_CASES.length };
    } catch (error) {
      const [latest, saved] = await Promise.all([
        supabaseAdmin.from(RUN_TABLE).select('completed_cases').eq('id', data.run_id).eq('workspace_id', data.workspace_id).single(),
        supabaseAdmin.from(RESULT_TABLE).select('*').eq('run_id', data.run_id).eq('workspace_id', data.workspace_id),
      ]);
      const savedRows = saved.error ? [] : saved.data ?? [];
      const observations: EvaluationObservation[] = savedRows.map(row => ({
        case_id: row.case_key, title: row.case_title,
        deterministic_expected: row.expected_deterministic as unknown as EvaluationObservation['deterministic_expected'],
        deterministic_predicted: row.predicted_deterministic as unknown as EvaluationObservation['deterministic_predicted'],
        ai_expected: row.expected_ai as unknown as EvaluationObservation['ai_expected'],
        ai_predicted: row.ai_status === 'completed' ? row.predicted_ai as unknown as NonNullable<EvaluationObservation['ai_predicted']> : null,
        unguided_ai_predicted: row.unguided_ai_status === 'completed' ? row.predicted_ai_unguided as unknown as NonNullable<EvaluationObservation['unguided_ai_predicted']> : null,
      }));
      const metrics = evaluateObservations(observations);
      if (!latest.error) {
        const terminal = savedRows.length > 0 ? 'partial' : 'failed';
        await supabaseAdmin.from(RUN_TABLE).update({ status: terminal, completed_cases: savedRows.length, metrics: metrics as unknown as Json,
          error_summary: 'The evaluation stopped unexpectedly. Any saved case results were retained.', completed_at: new Date().toISOString(), batch_lease_token: null, lease_expires_at: null })
          .eq('id', data.run_id).eq('workspace_id', data.workspace_id).eq('batch_lease_token', token);
      }
      throw error instanceof Error ? error : new Error('The evaluation batch failed');
    } finally {
      // Releases an unfinished batch lease. Completed/partial/failed rows are immutable by the database guard.
      await supabaseAdmin.from(RUN_TABLE).update({ batch_lease_token: null, lease_expires_at: null })
        .eq('id', data.run_id).eq('workspace_id', data.workspace_id).eq('batch_lease_token', token).in('status', ['queued', 'running']);
    }
  });
