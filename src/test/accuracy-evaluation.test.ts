import { describe, expect, it, vi } from 'vitest';
import { AI_CATEGORIES, ACCURACY_CASES, ACCURACY_CHECKS, checkInputForCase } from '@/lib/accuracy-dataset';
import { confusionMetrics, evaluateObservations, type EvaluationObservation } from '@/lib/accuracy-evaluation';
import { assertAccuracyAdmin } from '@/lib/accuracy-evaluation.functions';
import { executeAccuracyCase } from '@/lib/accuracy-evaluator.server';
import { runChecks } from '@/lib/checks';
import { validateAiResponse, type ValidatedFinding } from '@/lib/ai-review';

function aiFinding(overrides: Partial<ValidatedFinding> = {}): ValidatedFinding {
  return { category: 'claim', severity: 'medium', confidence: 1, span_start: 0, span_end: 3, quoted_text: '40%', explanation: '',
    cited_kind: 'none', cited_id: null, cited_code: '', cited_passage: '', outcome: 'cannot_verify', citation_status: 'not_required',
    suggested_text: null, evidence_kind: 'text', bbox: null, ...overrides };
}

describe('accuracy metrics', () => {
  it('labels verified, missing, invalid and context-free citations distinctly', () => {
    const common = { category: 'claim', severity: 'medium', confidence: 1, explanation: '', suggested_text: null, bbox: null };
    const raw = { visible_text: null, findings: [
      { ...common, quoted_text: '40%', verdict: 'supported', cited_code: 'FACT-1', cited_passage: 'Up to 40%' },
      { ...common, quoted_text: '45%', verdict: 'supported', cited_code: 'FAKE-1', cited_passage: 'Invented source' },
      { ...common, quoted_text: '50%', verdict: 'supported', cited_code: null, cited_passage: null },
      { ...common, quoted_text: '60%', verdict: 'cannot_verify', cited_code: null, cited_passage: null },
      { ...common, quoted_text: '70%', verdict: 'supported', cited_code: 'ANY-1', cited_passage: 'Uncheckable' },
    ] };
    const sources = [{ kind: 'fact' as const, id: 'fact-id', code: 'FACT-1', text: 'Up to 40%', tone: false }];
    const guided = validateAiResponse(raw, { evidenceText: '40% 45% 50% 60% 70%', isImage: false, sources }).findings;
    expect(guided.map(f => f.citation_status)).toEqual(['verified', 'invalid', 'missing', 'not_required', 'invalid']);
    const noSources = validateAiResponse({ ...raw, findings: [raw.findings[4]] }, { evidenceText: '70%', isImage: false, sources: [], citationContext: 'unguided' }).findings;
    expect(noSources[0]?.citation_status).toBe('unverifiable');
    expect(noSources[0]?.outcome).toBe('cannot_verify');
  });

  it('calculates accuracy, precision, recall and F1 from a known confusion matrix', () => {
    const result = confusionMetrics(new Set(['tp', 'fn']), new Set(['tp', 'fp']), ['tp', 'fp', 'fn', 'tn']);
    expect(result).toMatchObject({ true_positives: 1, false_positives: 1, false_negatives: 1, true_negatives: 1, samples: 4, accuracy: 0.5, precision: 0.5, recall: 0.5, f1: 0.5 });
  });

  it('returns zero for empty and zero-denominator datasets without NaN', () => {
    expect(confusionMetrics(new Set(), new Set(), [])).toEqual({ accuracy: 0, precision: 0, recall: 0, f1: 0, true_positives: 0, false_positives: 0, false_negatives: 0, true_negatives: 0, samples: 0 });
    const allNegative = confusionMetrics(new Set(), new Set(), ['a', 'b']);
    expect(allNegative).toMatchObject({ accuracy: 1, precision: 0, recall: 0, f1: 0, true_negatives: 2 });
    expect(Object.values(allNegative).every(value => typeof value !== 'number' || Number.isFinite(value))).toBe(true);
  });

  it('runs the existing deterministic checker against hand-labelled examples', () => {
    const restricted = ACCURACY_CASES.find(row => row.id === 'restricted-guarantee')!;
    const results = runChecks(checkInputForCase(restricted)).findings;
    expect(results).toEqual(expect.arrayContaining([expect.objectContaining({ check_name: 'banned_term', quoted_text: 'guarantee', outcome: 'violation', cited_code: 'LEGAL-03' })]));
    const clean = ACCURACY_CASES.find(row => row.id === 'clean-neutral-copy')!;
    expect(runChecks(checkInputForCase(clean)).findings).toEqual([]);
    expect(ACCURACY_CHECKS).toHaveLength(3);
  });

  it('matches findings exactly and retains false-positive and false-negative examples', () => {
    const observation: EvaluationObservation = {
      case_id: 'case', title: 'Example',
      deterministic_expected: [{ check_name: 'banned_term', category: 'legal', quoted_text: 'guarantee', outcome: 'violation', cited_code: 'LEGAL-03' }],
      deterministic_predicted: [{ check_name: 'banned_term', category: 'legal', severity: 'high', confidence: 1, span_start: 0, span_end: 9, quoted_text: 'guarantee', explanation: '', cited_kind: 'rule', cited_id: 'r', cited_code: 'LEGAL-03', cited_passage: '', outcome: 'violation' }],
      ai_expected: [{ category: 'legal', quoted_text: 'guarantee', verdict: 'violation' }],
      ai_predicted: [],
    };
    const metrics = evaluateObservations([observation]);
    expect(metrics.false_positives.deterministic).toEqual([]);
    expect(metrics.false_negatives.deterministic).toEqual([]);
    expect(metrics.false_negatives.ai).toEqual([expect.objectContaining({ case_id: 'case', quoted_text: 'guarantee', outcome: 'violation' })]);
    expect(metrics.ai).toMatchObject({ false_negatives: 1, true_negatives: AI_CATEGORIES.length * 4 - 1, samples: AI_CATEGORIES.length * 4, accuracy: (AI_CATEGORIES.length * 4 - 1) / (AI_CATEGORIES.length * 4) });
  });

  it('counts unmatched extra predictions as false positives and missing labels as false negatives', () => {
    const observation: EvaluationObservation = {
      case_id: 'mismatch', title: 'Mismatch', deterministic_expected: [],
      deterministic_predicted: [{ check_name: 'numeric_claim', category: 'claim', severity: 'medium', confidence: 0.5, span_start: 3, span_end: 6, quoted_text: '45%', explanation: '', cited_kind: 'spec', cited_id: null, cited_code: 'NUMERIC-CLAIM', cited_passage: '', outcome: 'cannot_verify' }],
      ai_expected: [], ai_predicted: [],
    };
    const metrics = evaluateObservations([observation]);
    expect(metrics.false_positives.deterministic).toEqual([expect.objectContaining({ label: 'NUMERIC-CLAIM', quoted_text: '45%' })]);
    expect(metrics.false_negatives.deterministic).toEqual([]);
    expect(metrics.deterministic.false_positives).toBe(1);
  });

  it('compares paired guided and unguided findings from the same labelled claim', () => {
    const observation: EvaluationObservation = {
      case_id: 'paired', title: 'Paired example', deterministic_expected: [], deterministic_predicted: [],
      ai_expected: [{ category: 'claim', quoted_text: '40%', verdict: 'supported' }],
      ai_predicted: [aiFinding({ outcome: 'supported', cited_kind: 'fact', cited_id: 'fact-1', cited_code: 'FACT-1', cited_passage: 'Up to 40%', citation_status: 'verified' })],
      unguided_ai_predicted: [aiFinding({ outcome: 'cannot_verify', citation_status: 'not_required' })],
    };
    const metrics = evaluateObservations([observation]);
    expect(metrics.guided_vs_unguided).toEqual({ guided_f1: 1, unguided_f1: 0, f1_delta: 1, comparable_cases: 1 });
    expect(metrics.cannot_verify.unguided.false_positives).toBe(1);
    expect(metrics.citations.guided).toMatchObject({ expected_citations: 1, verified_citations: 1, missing_required_citations: 0, invalid_citation_attempts: 0, hallucinated_citation_rate: 0 });
    expect(metrics.citations.unguided).toMatchObject({ expected_citations: 1, verified_citations: 0, missing_required_citations: 1 });
  });

  it('scores cannot-verify decisions against both positive and negative labelled claims', () => {
    const observation: EvaluationObservation = {
      case_id: 'classification', title: 'Classification examples', deterministic_expected: [], deterministic_predicted: [],
      ai_expected: [{ category: 'claim', quoted_text: '45%', verdict: 'cannot_verify' }, { category: 'claim', quoted_text: '40%', verdict: 'supported' }, { category: 'claim', quoted_text: '30%', verdict: 'supported' }],
      ai_predicted: [aiFinding({ quoted_text: '40%', outcome: 'cannot_verify' })],
    };
    const metrics = evaluateObservations([observation]).cannot_verify.guided;
    expect(metrics).toMatchObject({ true_positives: 0, false_positives: 1, false_negatives: 1, true_negatives: 1, samples: 3, precision: 0, recall: 0, f1: 0 });
  });

  it('distinguishes invalid, missing, unverifiable and not-required citations', () => {
    const observation: EvaluationObservation = {
      case_id: 'citations', title: 'Citation states', deterministic_expected: [], deterministic_predicted: [],
      ai_expected: [{ category: 'claim', quoted_text: '40%', verdict: 'supported' }, { category: 'claim', quoted_text: '45%', verdict: 'cannot_verify' }],
      ai_predicted: [
        aiFinding({ quoted_text: '40%', outcome: 'cannot_verify', citation_status: 'missing' }),
        aiFinding({ quoted_text: '45%', outcome: 'cannot_verify', citation_status: 'not_required' }),
        aiFinding({ quoted_text: '60%', outcome: 'cannot_verify', citation_status: 'invalid', cited_code: 'MADE-UP' }),
      ],
      unguided_ai_predicted: [aiFinding({ quoted_text: '40%', citation_status: 'unverifiable', cited_code: 'FACT-1' })],
    };
    const metrics = evaluateObservations([observation]);
    expect(metrics.citations.guided).toMatchObject({ expected_citations: 1, verified_citations: 0, missing_required_citations: 1, invalid_citation_attempts: 1, not_required: 1, hallucinated_citation_rate: 1 });
    expect(metrics.citations.unguided.unverifiable_citation_attempts).toBe(1);
  });
});

describe('accuracy case execution and run safety', () => {
  it('runs the same model with workspace guidance and with an empty source context', async () => {
    const testCase = ACCURACY_CASES.find(row => row.id === 'supported-approved-fact')!;
    const caller = vi.fn(async ({ system, messages }: { system: string; messages: unknown[] }) => {
      expect(system).toContain('Do not use outside knowledge');
      const guided = JSON.stringify(messages).includes('FACT-014');
      return { visible_text: null, findings: guided ? [{ quoted_text: '40%', verdict: 'supported', category: 'claim', severity: 'medium', confidence: 0.9, explanation: 'Supported by the approved fact.', cited_code: 'FACT-014', cited_passage: 'Reduces onboarding time by up to 40%.', suggested_text: null, bbox: null }] : [] };
    });
    let reservations = 0;
    const result = await executeAccuracyCase(testCase, { asOfDate: '2026-11-10', callModel: caller, beforeAiCall: async () => { reservations++; } });
    expect(caller).toHaveBeenCalledTimes(2); expect(reservations).toBe(2);
    expect(result).toMatchObject({ deterministic_status: 'completed', ai_status: 'completed', unguided_ai_status: 'completed', ai_call_count: 2 });
    expect(result.predicted_ai?.[0]).toMatchObject({ outcome: 'supported', citation_status: 'verified', cited_code: 'FACT-014', quoted_text: '40%' });
    expect(result.predicted_ai_unguided).toEqual([]);
  });

  it('records failures for both paired calls without discarding deterministic findings', async () => {
    const testCase = ACCURACY_CASES.find(row => row.id === 'restricted-guarantee')!;
    const failed = await executeAccuracyCase(testCase, { asOfDate: '2026-11-10', callModel: async () => { throw new Error('gateway unavailable'); } });
    expect(failed).toMatchObject({ deterministic_status: 'completed', ai_status: 'failed', ai_error: 'unavailable', unguided_ai_status: 'failed', unguided_ai_error: 'unavailable', ai_call_count: 2 });
    expect(failed.predicted_deterministic).toEqual(expect.arrayContaining([expect.objectContaining({ quoted_text: 'guarantee' })]));
    expect(failed.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

describe('accuracy Admin authorization', () => {
  it('requires Admin role in the exact requested workspace', async () => {
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => ({ data: args['_role'] === 'admin' && args['_workspace_id'] === 'allowed-workspace', error: null }));
    const ctx = { userId: 'admin-user', supabase: { rpc } };
    await expect(assertAccuracyAdmin(ctx, 'allowed-workspace')).resolves.toBeUndefined();
    await expect(assertAccuracyAdmin(ctx, 'foreign-workspace')).rejects.toThrow('Workspace administrator access required');
    expect(rpc).toHaveBeenCalledWith('has_role', { _user_id: 'admin-user', _role: 'admin', _workspace_id: 'foreign-workspace' });
  });

  it.each(['creator', 'manager', 'reviewer'])('rejects the %s role from evaluation access', async role => {
    const ctx = { userId: `${role}-user`, supabase: { rpc: async () => ({ data: false, error: null }) } };
    await expect(assertAccuracyAdmin(ctx, 'workspace')).rejects.toThrow('Workspace administrator access required');
  });
});
