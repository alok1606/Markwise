import { describe, expect, it } from 'vitest';
import { buildSources, errorKindForStatus, InvalidAiResponseError, overlapsWithDeterministic, validateAiResponse, validBbox, type FactRow, type GlossaryRow, type RuleRow } from '@/lib/ai-review';

const rule = (o: Partial<RuleRow> = {}): RuleRow => ({ id: 'r1', code: 'R-1', title: 'No guarantees', description: 'Never promise guaranteed results.', explanation: '', examples: '', category: 'legal', kind: 'banned_term', severity: 'critical', active: true, ...o });
const fact = (o: Partial<FactRow> = {}): FactRow => ({ id: 'f1', code: 'F-1', title: 'Onboarding', statement: 'Onboarding takes 5 days on average.', evidence: 'Ops report 2026', status: 'approved', active: true, valid_from: null, valid_until: null, ...o });
const gloss = (o: Partial<GlossaryRow> = {}): GlossaryRow => ({ id: 'g1', preferred_term: 'customers', avoided_terms: ['clients'], note: '', usage_example: '', ...o });
const today = '2026-11-05';
const F = (o: Record<string, unknown> = {}) => ({ quoted_text: 'Guaranteed', verdict: 'violation', category: 'legal', severity: 'critical', confidence: 0.9, explanation: 'x', cited_code: 'R-1', cited_passage: 'Never promise guaranteed results.', suggested_text: null, bbox: null, ...o });
const text = 'Guaranteed onboarding for clients in 2 days 🚀, 40% faster. Guaranteed.';
const run = (findings: unknown[], o: { rules?: RuleRow[]; facts?: FactRow[]; glossary?: GlossaryRow[]; image?: boolean; visible?: string | null; evidence?: string } = {}) =>
  validateAiResponse({ visible_text: o.visible ?? null, findings }, { evidenceText: o.evidence ?? text, isImage: !!o.image, sources: buildSources(o.rules ?? [rule()], o.facts ?? [fact()], o.glossary ?? [gloss()], today) });

describe('AI review validation', () => {
  it('keeps a valid rule violation with a verified citation and server-computed offsets', () => {
    const r = run([F()]);
    expect(r).toMatchObject({ dropped: 0, downgraded: 0 });
    expect(r.findings[0]).toMatchObject({ outcome: 'violation', cited_kind: 'rule', cited_id: 'r1', cited_code: 'R-1', span_start: 0, span_end: 10 });
  });
  it('drops fabricated quotations that are not exact substrings', () => {
    const r = run([F({ quoted_text: 'guaranteed results' }), F({ quoted_text: 'GUARANTEED' }), F({ quoted_text: '' })]);
    expect(r.findings).toHaveLength(0); expect(r.dropped).toBe(3);
  });
  it('assigns repeated quotes to successive occurrences, then drops extras', () => {
    const r = run([F(), F(), F()]);
    expect(r.findings.map(f => f.span_start)).toEqual([0, text.lastIndexOf('Guaranteed')]); expect(r.dropped).toBe(1);
  });
  it('computes UTF-16 offsets correctly after emoji', () => {
    const r = run([F({ quoted_text: '40%', verdict: 'cannot_verify', cited_code: null, cited_passage: null })]);
    const f = r.findings[0]!; expect(text.slice(f.span_start, f.span_end)).toBe('40%'); expect(f.span_start).toBe(text.indexOf('40%'));
  });
  it('downgrades unknown (fabricated) citation codes', () => {
    const r = run([F({ cited_code: 'R-999' })]);
    expect(r.findings[0]).toMatchObject({ outcome: 'cannot_verify', cited_kind: 'none', cited_code: '', cited_passage: '', cited_id: null }); expect(r.downgraded).toBe(1);
  });
  it('downgrades citations of inactive rules (not in context)', () => {
    const r = run([F()], { rules: [rule({ active: false })] });
    expect(r.findings[0]!.outcome).toBe('cannot_verify'); expect(r.downgraded).toBe(1);
  });
  it('downgrades citations of unapproved, rejected, inactive or expired facts', () => {
    for (const facts of [[fact({ status: 'pending' })], [fact({ status: 'rejected' })], [fact({ active: false })], [fact({ valid_until: '2026-01-01' })], [fact({ valid_from: '2027-01-01' })]]) {
      const r = run([F({ quoted_text: 'in 2 days', verdict: 'contradicted', cited_code: 'F-1', cited_passage: 'Onboarding takes 5 days on average.' })], { facts });
      expect(r.findings[0]!.outcome).toBe('cannot_verify'); expect(r.findings[0]!.cited_kind).toBe('none');
    }
  });
  it('keeps a contradicted claim citing an approved fact', () => {
    const r = run([F({ quoted_text: 'in 2 days', verdict: 'contradicted', cited_code: 'F-1', cited_passage: '5 days on average' })]);
    expect(r.findings[0]).toMatchObject({ outcome: 'contradicted', cited_kind: 'fact', cited_id: 'f1' });
  });
  it('downgrades passage mismatches', () => {
    const r = run([F({ cited_passage: 'Always promise guaranteed results.' }), F({ cited_passage: '' })]);
    expect(r.findings.every(f => f.outcome === 'cannot_verify')).toBe(true); expect(r.downgraded).toBe(2);
  });
  it('downgrades a verdict citing the wrong kind of source', () => {
    const r = run([F({ verdict: 'supported', cited_code: 'R-1' }), F({ verdict: 'violation', cited_code: 'F-1', cited_passage: '5 days' })]);
    expect(r.findings.map(f => f.outcome)).toEqual(['cannot_verify', 'cannot_verify']);
  });
  it('accepts glossary citations by glossary code', () => {
    const r = run([F({ quoted_text: 'clients', category: 'terminology', severity: 'medium', cited_code: 'GLOSSARY:customers', cited_passage: 'clients' })]);
    expect(r.findings[0]).toMatchObject({ outcome: 'violation', cited_kind: 'glossary', cited_id: 'g1' });
  });
  it('strips citations from cannot_verify findings without counting a downgrade', () => {
    const r = run([F({ quoted_text: '40%', verdict: 'cannot_verify' })]);
    expect(r.findings[0]).toMatchObject({ cited_kind: 'none', cited_code: '' }); expect(r.downgraded).toBe(0);
  });
  it('drops tone findings unless a tone rule is cited', () => {
    const tone = rule({ id: 'r2', code: 'T-1', category: 'tone', kind: 'tone_guidance', description: 'Avoid hype.' });
    expect(run([F({ category: 'tone' })], { rules: [rule(), tone] }).dropped).toBe(1);
    expect(run([F({ category: 'tone', cited_code: 'T-1', cited_passage: 'Avoid hype.' })], { rules: [rule(), tone] }).findings[0]!.outcome).toBe('violation');
  });
  it('rejects an invalid schema entirely', () => {
    expect(() => validateAiResponse({ findings: [{ quoted_text: 1 }] }, { evidenceText: text, isImage: false, sources: [] })).toThrow(InvalidAiResponseError);
    expect(() => validateAiResponse('nope', { evidenceText: text, isImage: false, sources: [] })).toThrow(InvalidAiResponseError);
    expect(() => validateAiResponse({ visible_text: null, findings: [F({ verdict: 'approved' })] }, { evidenceText: text, isImage: false, sources: [] })).toThrow(InvalidAiResponseError);
  });
  it('clamps confidence and caps findings', () => {
    expect(run([F({ confidence: 7 })]).findings[0]!.confidence).toBe(1);
    const many = Array.from({ length: 250 }, () => F({ quoted_text: 'a', verdict: 'cannot_verify' }));
    const r = run(many, { evidence: 'a'.repeat(300) }); expect(r.findings).toHaveLength(200); expect(r.dropped).toBe(50);
  });
});

describe('AI image evidence', () => {
  const visible = 'GUARANTEED RESULTS\nJoin 10,000 clients';
  it('uses the OCR text, not the version text, for offsets and keeps a valid box', () => {
    const r = run([F({ quoted_text: 'GUARANTEED', cited_passage: 'guaranteed results', bbox: [100, 100, 300, 600] })], { image: true, visible, evidence: '' });
    expect(r.findings[0]).toMatchObject({ evidence_kind: 'image_ocr', span_start: 0, span_end: 10, outcome: 'violation', bbox: [0.1, 0.1, 0.5, 0.2] }); expect(r.evidence_text).toBe(visible);
  });
  it('drops image quotes not present in the OCR text', () => {
    expect(run([F({ quoted_text: 'Guaranteed', bbox: [0, 0, 1000, 1000] })], { image: true, visible, evidence: text }).dropped).toBe(1);
    expect(run([F({ bbox: [0, 0, 1, 1] })], { image: true, visible: null }).dropped).toBe(1);
  });
  it('downgrades image findings with missing or invalid boxes', () => {
    for (const bbox of [null, [500, 500, 400, 600], [0, 0, 0, 100], [-10, 0, 200, 200], [0, 0, 200], [0, 0, 1200, 500]]) {
      const r = run([F({ quoted_text: 'GUARANTEED', cited_passage: 'guaranteed results', bbox })], { image: true, visible });
      expect(r.findings[0]).toMatchObject({ outcome: 'cannot_verify', cited_kind: 'none', bbox: null }); expect(r.downgraded).toBe(1);
    }
    expect(validBbox([0, 0, 1, 1])).toBe(true);
  });
});

describe('presentation dedup and errors', () => {
  it('links overlapping AI and deterministic findings without merging records', () => {
    const ai = [{ id: 'a', span_start: 0, span_end: 21, evidence_kind: 'text' }, { id: 'b', span_start: 40, span_end: 45, evidence_kind: 'text' }, { id: 'c', span_start: 0, span_end: 5, evidence_kind: 'image_ocr' }];
    const det = [{ id: 'd', check_name: 'banned_term', span_start: 0, span_end: 10 }];
    const m = overlapsWithDeterministic(ai, det); expect([...m.keys()]).toEqual(['a']); expect(m.get('a')![0]!.id).toBe('d');
  });
  it('maps gateway statuses to user-facing error kinds', () => {
    expect([429, 402, 401, 504, 400, 500, 403].map(errorKindForStatus)).toEqual(['rate_limited', 'credits', 'configuration', 'timeout', 'configuration', 'unavailable', 'unavailable']);
  });
});
