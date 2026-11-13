import type { BannedRule, CheckInput, Finding, GlossaryEntry } from './checks';
import type { FactRow, GlossaryRow, RuleRow } from './ai-review';

export const ACCURACY_DATASET_VERSION = 'markwise-labels-v2';
export const EVALUATOR_VERSION = 'markwise-evaluator-v2';
export const ACCURACY_CHECKS = ['banned_term', 'terminology', 'numeric_claim'] as const;
export const AI_CATEGORIES = ['legal', 'claim', 'terminology', 'tone', 'visual', 'accessibility'] as const;

export type ExpectedDeterministicFinding = Pick<Finding, 'check_name' | 'category' | 'quoted_text' | 'outcome' | 'cited_code'>;
export type ExpectedAiFinding = { category: string; quoted_text: string; verdict: 'violation' | 'supported' | 'contradicted' | 'cannot_verify' };
export type AccuracyCase = {
  id: string;
  title: string;
  text: string;
  checkInput: Omit<CheckInput, 'body_text'>;
  expectedDeterministic: ExpectedDeterministicFinding[];
  expectedAi: ExpectedAiFinding[];
};

const rule: RuleRow = {
  id: 'ed111111-1111-4111-8111-111111111111', code: 'LEGAL-03', title: 'Avoid absolute guarantees',
  description: 'Do not promise guaranteed outcomes.', explanation: 'Avoid absolute promises.', examples: 'guaranteed results',
  category: 'legal', kind: 'banned_term', severity: 'high', active: true,
};
const checkRule: BannedRule = {
  id: rule.id, code: rule.code, title: rule.title, description: rule.description, severity: 'high', category: 'legal', active: true,
  kind: 'banned_term', pattern: { terms: ['guarantee', 'guaranteed'] },
};
const glossary: GlossaryRow = {
  id: 'ed222222-2222-4222-8222-222222222222', preferred_term: 'clients', avoided_terms: ['customers'],
  note: 'Use the approved audience term.', usage_example: 'Our clients use Markwise to review content.',
};
const checkGlossary: GlossaryEntry = { id: glossary.id, preferred_term: glossary.preferred_term, avoided_terms: glossary.avoided_terms, case_sensitive: false, note: glossary.note };
const approvedFact: FactRow = {
  id: 'ed333333-3333-4333-8333-333333333333', code: 'FACT-014', title: 'Onboarding time',
  statement: 'Reduces onboarding time by up to 40%.', evidence: 'Approved product study: up to 40% reduction.',
  status: 'approved', active: true, valid_from: null, valid_until: null,
};

function input(): Omit<CheckInput, 'body_text'> {
  return { type: 'text', alt_text: null, text_color: null, background_color: null,
    rules: [checkRule], glossary: [checkGlossary], palette: [], colour_samples: null, image_error: null };
}

/** Manually labelled fictional examples. This fixed pack measures the production check and validation functions. */
export const ACCURACY_CASES: AccuracyCase[] = [
  {
    id: 'clean-neutral-copy', title: 'Neutral copy with no flagged claim', text: 'Explore the workspace and find the guidance your team needs.',
    checkInput: input(), expectedDeterministic: [], expectedAi: [],
  },
  {
    id: 'restricted-guarantee', title: 'Restricted guarantee wording', text: 'We guarantee a smoother start for every team.',
    checkInput: input(), expectedDeterministic: [{ check_name: 'banned_term', category: 'legal', quoted_text: 'guarantee', outcome: 'violation', cited_code: 'LEGAL-03' }],
    expectedAi: [{ category: 'legal', quoted_text: 'guarantee', verdict: 'violation' }],
  },
  {
    id: 'avoided-audience-term', title: 'Avoided glossary terminology', text: 'Our customers can review brand content in one workspace.',
    checkInput: input(), expectedDeterministic: [{ check_name: 'terminology', category: 'terminology', quoted_text: 'customers', outcome: 'violation', cited_code: 'clients' }],
    expectedAi: [{ category: 'terminology', quoted_text: 'customers', verdict: 'violation' }],
  },
  {
    id: 'unverified-percentage', title: 'Unverified percentage claim', text: 'Teams save 45% on onboarding with this workflow.',
    checkInput: input(), expectedDeterministic: [{ check_name: 'numeric_claim', category: 'claim', quoted_text: '45%', outcome: 'cannot_verify', cited_code: 'NUMERIC-CLAIM' }],
    expectedAi: [{ category: 'claim', quoted_text: '45%', verdict: 'cannot_verify' }],
  },
  {
    id: 'supported-approved-fact', title: 'Claim aligned with an approved fact', text: 'Reduces onboarding time by up to 40%.',
    checkInput: input(), expectedDeterministic: [{ check_name: 'numeric_claim', category: 'claim', quoted_text: '40%', outcome: 'cannot_verify', cited_code: 'NUMERIC-CLAIM' }],
    expectedAi: [{ category: 'claim', quoted_text: '40%', verdict: 'supported' }],
  },
  {
    id: 'contradicted-approved-fact', title: 'Claim exceeding an approved fact', text: 'Reduces onboarding time by up to 60%.',
    checkInput: input(), expectedDeterministic: [{ check_name: 'numeric_claim', category: 'claim', quoted_text: '60%', outcome: 'cannot_verify', cited_code: 'NUMERIC-CLAIM' }],
    expectedAi: [{ category: 'claim', quoted_text: '60%', verdict: 'contradicted' }],
  },
  {
    id: 'combined-rule-and-glossary', title: 'Two distinct deterministic checks', text: 'We guarantee our customers a clear review.',
    checkInput: input(), expectedDeterministic: [
      { check_name: 'banned_term', category: 'legal', quoted_text: 'guarantee', outcome: 'violation', cited_code: 'LEGAL-03' },
      { check_name: 'terminology', category: 'terminology', quoted_text: 'customers', outcome: 'violation', cited_code: 'clients' },
    ], expectedAi: [
      { category: 'legal', quoted_text: 'guarantee', verdict: 'violation' },
      { category: 'terminology', quoted_text: 'customers', verdict: 'violation' },
    ],
  },
  {
    id: 'clean-supported-description', title: 'Non-numeric product description', text: 'Markwise helps teams apply their approved brand guidance.',
    checkInput: input(), expectedDeterministic: [], expectedAi: [],
  },
];

export function checkInputForCase(testCase: AccuracyCase): CheckInput {
  return { ...testCase.checkInput, body_text: testCase.text };
}

export function aiSourcesForCase(testCase: AccuracyCase) {
  return { rules: [rule], facts: testCase.id === 'supported-approved-fact' || testCase.id === 'contradicted-approved-fact' ? [approvedFact] : [], glossary: [glossary] };
}
