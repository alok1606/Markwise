import { AI_PROMPT_VERSION, AI_SYSTEM_INSTRUCTION, buildSources, validateAiResponse, type ValidatedFinding } from './ai-review';
import { AI_MODEL, AiCallError, callGatewayModel, type ModelCaller } from './ai-gateway.server';
import { buildTextReviewMessages } from './ai-review.server';
import { runChecks, type Finding } from './checks';
import { ACCURACY_DATASET_VERSION, EVALUATOR_VERSION, aiSourcesForCase, checkInputForCase, type AccuracyCase } from './accuracy-dataset';

export type AccuracyCaseExecution = {
  case_key: string;
  case_title: string;
  input_text: string;
  deterministic_status: 'completed' | 'failed';
  ai_status: 'completed' | 'failed';
  expected_deterministic: AccuracyCase['expectedDeterministic'];
  predicted_deterministic: Finding[];
  expected_ai: AccuracyCase['expectedAi'];
  predicted_ai: ValidatedFinding[] | null;
  ai_error: string | null;
  unguided_ai_status: 'completed' | 'failed';
  predicted_ai_unguided: ValidatedFinding[] | null;
  unguided_ai_error: string | null;
  ai_call_count: 0 | 2;
  duration_ms: number;
};

export async function executeAccuracyCase(testCase: AccuracyCase, options: { asOfDate: string; callModel?: ModelCaller; beforeAiCall?: () => Promise<void> }): Promise<AccuracyCaseExecution> {
  const started = Date.now();
  const deterministic = runChecks(checkInputForCase(testCase));
  const fixture = aiSourcesForCase(testCase);
  const sources = buildSources(fixture.rules, fixture.facts, fixture.glossary, options.asOfDate);
  const aiCall = options.callModel ?? callGatewayModel;
  const runPass = async (passSources: typeof sources, context: 'guided' | 'unguided') => {
    // Reserve every individual gateway call before sending it. A reservation failure aborts this
    // case instead of being mislabeled as a model failure or counted as an unpermitted call.
    await options.beforeAiCall?.();
    try {
      // Both passes use the exact same model, system instruction and response validator. The
      // control pass receives an explicitly empty source context (no workspace brand guidance).
      const raw = await aiCall({ system: AI_SYSTEM_INSTRUCTION, messages: buildTextReviewMessages(testCase.text, passSources) });
      return { status: 'completed' as const, findings: validateAiResponse(raw, { evidenceText: testCase.text, isImage: false, sources: passSources, citationContext: context }).findings, error: null };
    } catch (error) {
      return { status: 'failed' as const, findings: null, error: error instanceof AiCallError ? error.kind : error instanceof Error ? safeAiError(error) : 'unavailable' };
    }
  };
  const guided = await runPass(sources, 'guided');
  const unguided = await runPass([], 'unguided');
  return {
    case_key: testCase.id, case_title: testCase.title, input_text: testCase.text,
    deterministic_status: 'completed', ai_status: guided.status,
    expected_deterministic: testCase.expectedDeterministic, predicted_deterministic: deterministic.findings,
    expected_ai: testCase.expectedAi, predicted_ai: guided.findings, ai_error: guided.error,
    unguided_ai_status: unguided.status, predicted_ai_unguided: unguided.findings, unguided_ai_error: unguided.error,
    ai_call_count: 2, duration_ms: Math.max(0, Date.now() - started),
  };
}

function safeAiError(error: Error): string {
  if (/invalid format|schema/i.test(error.message)) return 'invalid_response';
  if (/timeout|timed out/i.test(error.message)) return 'timeout';
  return 'unavailable';
}

export { ACCURACY_DATASET_VERSION, EVALUATOR_VERSION, AI_MODEL, AI_PROMPT_VERSION };
