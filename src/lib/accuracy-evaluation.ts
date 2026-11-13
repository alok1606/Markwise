import { ACCURACY_CHECKS, AI_CATEGORIES, type ExpectedAiFinding, type ExpectedDeterministicFinding } from './accuracy-dataset';
import type { Finding } from './checks';
import type { ValidatedFinding } from './ai-review';

export type EvaluationMetrics = {
  accuracy: number; precision: number; recall: number; f1: number;
  true_positives: number; false_positives: number; false_negatives: number; true_negatives: number; samples: number;
};
export type FindingMismatch = { case_id: string; title: string; label: string; quoted_text: string; outcome: string };
export type EvaluationObservation = {
  case_id: string; title: string;
  deterministic_expected: ExpectedDeterministicFinding[];
  deterministic_predicted: Finding[];
  ai_expected: ExpectedAiFinding[];
  ai_predicted: ValidatedFinding[] | null;
  unguided_ai_predicted?: ValidatedFinding[] | null;
};
export type CitationMetrics = {
  verification: EvaluationMetrics;
  expected_citations: number;
  verified_citations: number;
  missing_required_citations: number;
  invalid_citation_attempts: number;
  unverifiable_citation_attempts: number;
  not_required: number;
  hallucinated_citation_rate: number;
};
export type EvaluatedMetrics = {
  deterministic: EvaluationMetrics;
  ai: EvaluationMetrics;
  unguided_ai: EvaluationMetrics;
  guided_vs_unguided: { guided_f1: number; unguided_f1: number; f1_delta: number; comparable_cases: number };
  cannot_verify: { guided: EvaluationMetrics; unguided: EvaluationMetrics };
  citations: { guided: CitationMetrics; unguided: CitationMetrics };
  per_rule: Array<{ rule: string; metrics: EvaluationMetrics }>;
  false_positives: { deterministic: FindingMismatch[]; ai: FindingMismatch[]; unguided_ai: FindingMismatch[] };
  false_negatives: { deterministic: FindingMismatch[]; ai: FindingMismatch[]; unguided_ai: FindingMismatch[] };
  ai_cases_measured: number;
  ai_cases_failed: number;
  unguided_ai_cases_measured: number;
  unguided_ai_cases_failed: number;
};

function rate(numerator: number, denominator: number) { return denominator === 0 ? 0 : numerator / denominator; }

/** Binary multi-label metrics over each evaluated case × check/category. Empty universes return zero, never NaN. */
export function confusionMetrics(expectedLabels: Set<string>, predictedLabels: Set<string>, universe: string[]): EvaluationMetrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const label of universe) {
    const expected = expectedLabels.has(label); const predicted = predictedLabels.has(label);
    if (expected && predicted) tp++;
    else if (!expected && predicted) fp++;
    else if (expected && !predicted) fn++;
    else tn++;
  }
  const precision = rate(tp, tp + fp); const recall = rate(tp, tp + fn);
  return { accuracy: rate(tp + tn, tp + fp + fn + tn), precision, recall, f1: rate(2 * precision * recall, precision + recall),
    true_positives: tp, false_positives: fp, false_negatives: fn, true_negatives: tn, samples: universe.length };
}

function caseLabelMetrics<T>(
  observations: EvaluationObservation[], dimensions: readonly T[],
  expectedFor: (row: EvaluationObservation) => string[], predictedFor: (row: EvaluationObservation) => string[],
) {
  const universe = observations.flatMap(row => dimensions.map(d => `${row.case_id}:${String(d)}`));
  const expected = new Set(observations.flatMap(row => expectedFor(row).map(d => `${row.case_id}:${d}`)));
  const predicted = new Set(observations.flatMap(row => predictedFor(row).map(d => `${row.case_id}:${d}`)));
  return confusionMetrics(expected, predicted, universe);
}

function mismatchList<E, P>(
  observations: EvaluationObservation[], expectedFor: (row: EvaluationObservation) => E[], predictedFor: (row: EvaluationObservation) => P[],
  identity: (item: E | P) => string, label: (item: E | P) => string, quote: (item: E | P) => string, outcome: (item: E | P) => string,
): { false_positives: FindingMismatch[]; false_negatives: FindingMismatch[] } {
  const false_positives: FindingMismatch[] = []; const false_negatives: FindingMismatch[] = [];
  for (const row of observations) {
    const expected = expectedFor(row); const predicted = predictedFor(row); const used = new Set<number>();
    for (const item of expected) {
      const key = identity(item); const match = predicted.findIndex((candidate, index) => !used.has(index) && identity(candidate) === key);
      if (match >= 0) used.add(match);
      else false_negatives.push({ case_id: row.case_id, title: row.title, label: label(item), quoted_text: quote(item), outcome: outcome(item) });
    }
    predicted.forEach((item, index) => {
      if (!used.has(index)) false_positives.push({ case_id: row.case_id, title: row.title, label: label(item), quoted_text: quote(item), outcome: outcome(item) });
    });
  }
  return { false_positives, false_negatives };
}

function findingKey(caseId: string, category: string, quote: string) {
  return `${caseId}:${category.trim().toLocaleLowerCase()}|${quote.trim().toLocaleLowerCase()}`;
}

function cannotVerifyMetrics(rows: EvaluationObservation[], prediction: (row: EvaluationObservation) => ValidatedFinding[] | null | undefined) {
  const expected = new Set(rows.flatMap(row => row.ai_expected.filter(f => f.verdict === 'cannot_verify').map(f => findingKey(row.case_id, f.category, f.quoted_text))));
  const predicted = new Set(rows.flatMap(row => (prediction(row) ?? []).filter(f => f.outcome === 'cannot_verify').map(f => findingKey(row.case_id, f.category, f.quoted_text))));
  // Every labelled claim is a classification example. Supported/violating labels are
  // explicit negatives for cannot-verify, rather than disappearing from the denominator.
  const universe = rows.flatMap(row => row.ai_expected.map(f => findingKey(row.case_id, f.category, f.quoted_text)));
  return confusionMetrics(expected, predicted, [...new Set([...universe, ...predicted])]);
}

function citationMetrics(rows: EvaluationObservation[], prediction: (row: EvaluationObservation) => ValidatedFinding[] | null | undefined): CitationMetrics {
  const expected = new Set(rows.flatMap(row => row.ai_expected.filter(f => f.verdict !== 'cannot_verify').map(f => findingKey(row.case_id, f.category, f.quoted_text))));
  const predictedRows = rows.flatMap(row => (prediction(row) ?? []).map(f => ({ key: findingKey(row.case_id, f.category, f.quoted_text), finding: f })));
  const verified = new Set(predictedRows.filter(row => row.finding.citation_status === 'verified').map(row => row.key));
  const universe = [...new Set([...expected, ...predictedRows.map(row => row.key)])];
  const attempts = predictedRows.filter(row => row.finding.citation_status === 'verified' || row.finding.citation_status === 'invalid');
  const invalid = predictedRows.filter(row => row.finding.citation_status === 'invalid').length;
  return {
    verification: confusionMetrics(expected, verified, universe),
    expected_citations: expected.size,
    verified_citations: predictedRows.filter(row => row.finding.citation_status === 'verified').length,
    missing_required_citations: [...expected].filter(key => !verified.has(key)).length,
    invalid_citation_attempts: invalid,
    unverifiable_citation_attempts: predictedRows.filter(row => row.finding.citation_status === 'unverifiable').length,
    not_required: predictedRows.filter(row => row.finding.citation_status === 'not_required').length,
    hallucinated_citation_rate: rate(invalid, attempts.length),
  };
}

function aiMetrics(rows: EvaluationObservation[], prediction: (row: EvaluationObservation) => ValidatedFinding[] | null | undefined) {
  const outcomes = ['violation', 'supported', 'contradicted', 'cannot_verify'] as const;
  const categories = [...new Set([...AI_CATEGORIES, ...rows.flatMap(row => [...row.ai_expected.map(f => f.category), ...(prediction(row) ?? []).map(f => f.category)])])];
  return caseLabelMetrics(rows, categories.flatMap(category => outcomes.map(outcome => `${category}|${outcome}`)),
    row => row.ai_expected.map(f => `${f.category}|${f.verdict}`),
    row => (prediction(row) ?? []).map(f => `${f.category}|${f.outcome}`));
}

export function evaluateObservations(observations: EvaluationObservation[]): EvaluatedMetrics {
  const deterministic = caseLabelMetrics(observations, ACCURACY_CHECKS,
    row => row.deterministic_expected.map(f => f.check_name), row => row.deterministic_predicted.map(f => f.check_name));
  const guidedRows = observations.filter(row => row.ai_predicted !== null);
  const unguidedRows = observations.filter(row => row.unguided_ai_predicted != null);
  const comparableRows = observations.filter(row => row.ai_predicted !== null && row.unguided_ai_predicted != null);
  const deterministicMismatch = mismatchList(observations, row => row.deterministic_expected, row => row.deterministic_predicted,
    item => `${'check_name' in item ? item.check_name : ''}|${item.quoted_text.toLocaleLowerCase()}|${item.outcome}`,
    item => item.cited_code || item.check_name, item => item.quoted_text, item => item.outcome);
  const aiMismatch = mismatchList(guidedRows, row => row.ai_expected, row => row.ai_predicted ?? [],
    item => `${item.category.toLocaleLowerCase()}|${item.quoted_text.toLocaleLowerCase()}|${'verdict' in item ? item.verdict : item.outcome}`,
    item => item.category, item => item.quoted_text, item => 'verdict' in item ? item.verdict : item.outcome);
  const unguidedMismatch = mismatchList(unguidedRows, row => row.ai_expected, row => row.unguided_ai_predicted ?? [],
    item => `${item.category.toLocaleLowerCase()}|${item.quoted_text.toLocaleLowerCase()}|${'verdict' in item ? item.verdict : item.outcome}`,
    item => item.category, item => item.quoted_text, item => 'verdict' in item ? item.verdict : item.outcome);
  const guided = aiMetrics(guidedRows, row => row.ai_predicted);
  const unguided = aiMetrics(unguidedRows, row => row.unguided_ai_predicted);
  const comparableGuided = aiMetrics(comparableRows, row => row.ai_predicted);
  const comparableUnguided = aiMetrics(comparableRows, row => row.unguided_ai_predicted);
  return {
    deterministic, ai: guided, unguided_ai: unguided,
    guided_vs_unguided: { guided_f1: comparableGuided.f1, unguided_f1: comparableUnguided.f1, f1_delta: comparableGuided.f1 - comparableUnguided.f1, comparable_cases: comparableRows.length },
    cannot_verify: { guided: cannotVerifyMetrics(guidedRows, row => row.ai_predicted), unguided: cannotVerifyMetrics(unguidedRows, row => row.unguided_ai_predicted) },
    citations: { guided: citationMetrics(guidedRows, row => row.ai_predicted), unguided: citationMetrics(unguidedRows, row => row.unguided_ai_predicted) },
    per_rule: ACCURACY_CHECKS.map(rule => ({ rule, metrics: caseLabelMetrics(observations, [rule] as const,
      row => row.deterministic_expected.filter(f => f.check_name === rule).map(() => rule),
      row => row.deterministic_predicted.filter(f => f.check_name === rule).map(() => rule)) })),
    false_positives: { deterministic: deterministicMismatch.false_positives, ai: aiMismatch.false_positives, unguided_ai: unguidedMismatch.false_positives },
    false_negatives: { deterministic: deterministicMismatch.false_negatives, ai: aiMismatch.false_negatives, unguided_ai: unguidedMismatch.false_negatives },
    ai_cases_measured: guidedRows.length, ai_cases_failed: observations.length - guidedRows.length,
    unguided_ai_cases_measured: unguidedRows.length, unguided_ai_cases_failed: observations.length - unguidedRows.length,
  };
}
