import { describe, expect, it } from 'vitest';
import { checkAltText, checkBannedTerms, checkContrast, checkNumericClaims, checkPalette, checkTerminology, contrastRatio, deltaE76, findOccurrences, relativeLuminance, rgbToLab, runChecks, sampleColours, validateSpans, type BannedRule } from '@/lib/checks';

const rule = (code: string, terms: string[], extra: Partial<BannedRule> = {}): BannedRule => ({ id: `id-${code}`, code, title: `T ${code}`, description: `D ${code}`, severity: 'critical', category: 'legal', active: true, kind: 'banned_term', pattern: { terms }, ...extra });

describe('banned terms', () => {
  it('finds every occurrence case-insensitively with exact offsets and citation', () => {
    const t = 'Guaranteed results. Fully GUARANTEED.';
    const f = checkBannedTerms(t, [rule('LEGAL-03', ['guaranteed'])]);
    expect(f.map(x => [x.span_start, x.span_end, x.quoted_text])).toEqual([[0, 10, 'Guaranteed'], [26, 36, 'GUARANTEED']]);
    expect(f[0]).toMatchObject({ cited_code: 'LEGAL-03', cited_id: 'id-LEGAL-03', cited_passage: 'D LEGAL-03', outcome: 'violation', severity: 'critical' });
  });
  it('uses whole words, so "unguaranteed" and "guaranteedly" do not match', () => {
    expect(checkBannedTerms('unguaranteed guaranteedly', [rule('L', ['guaranteed'])])).toEqual([]);
  });
  it('matches hyphenated and multi-word terms and punctuation boundaries', () => {
    const t = 'A risk-free plan, (no  risk)!';
    const f = checkBannedTerms(t, [rule('L1', ['risk-free', 'no risk'])]);
    expect(f.map(x => x.quoted_text)).toEqual(['risk-free', 'no  risk']);
  });
  it('reports overlapping terms from different rules separately and dedupes within a rule', () => {
    const t = 'best-in-class';
    const f = checkBannedTerms(t, [rule('A', ['best-in-class', 'best-in-class']), rule('B', ['best'])]);
    expect(f.map(x => `${x.cited_code}:${x.span_start}-${x.span_end}`)).toEqual(['B:0-4', 'A:0-13']);
  });
  it('ignores inactive rules, other kinds and empty term lists', () => {
    expect(checkBannedTerms('guaranteed', [rule('X', ['guaranteed'], { active: false }), rule('Y', ['guaranteed'], { kind: 'tone_guidance' }), rule('Z', [])])).toEqual([]);
  });
  it('uses UTF-16 offsets that slice back to the quote after emoji and accents', () => {
    const t = '🚀 Café garanti — 😀 guaranteed';
    const f = checkBannedTerms(t, [rule('L', ['guaranteed', 'café'])]);
    for (const x of f) expect(t.slice(x.span_start!, x.span_end!)).toBe(x.quoted_text);
    expect(f.map(x => x.quoted_text)).toEqual(['Café', 'guaranteed']);
    expect(f[0]!.span_start).toBe(3);
  });
  it('treats letters of other scripts as word characters', () => {
    expect(findOccurrences('naïveté', 'naïve')).toEqual([]);
    expect(findOccurrences('Grüße grüße', 'GRÜSSE')).toEqual([]); // no lossy case folding
  });
  it('handles empty input', () => { expect(checkBannedTerms('', [rule('L', ['x'])])).toEqual([]); });
  it('escapes regex characters in terms', () => { expect(findOccurrences('a+b (c)', '(c)')).toEqual([{ start: 4, end: 7 }]); });
});

describe('terminology', () => {
  const g = [{ id: 'g1', preferred_term: 'customers', avoided_terms: ['clients', 'client'], case_sensitive: false, note: 'n' }];
  it('flags avoided terms and cites the preferred term', () => {
    const f = checkTerminology('Our Clients and a client.', g);
    expect(f.map(x => [x.quoted_text, x.span_start])).toEqual([['Clients', 4], ['client', 18]]);
    expect(f[0]).toMatchObject({ cited_kind: 'glossary', cited_id: 'g1', cited_code: 'customers', explanation: 'Use "customers" instead of "Clients".' });
  });
  it('respects case-sensitive entries', () => {
    const cs = [{ id: 'g2', preferred_term: 'Nimbus Onboard', avoided_terms: ['Nimbus'], case_sensitive: true }];
    expect(checkTerminology('nimbus Nimbus', cs).map(x => x.span_start)).toEqual([7]);
  });
  it('handles empty glossary and text', () => { expect(checkTerminology('', g)).toEqual([]); expect(checkTerminology('clients', [])).toEqual([]); });
});

describe('numeric claims', () => {
  it('extracts percentages and numbers with units as cannot_verify only', () => {
    const t = 'Cuts onboarding by 40% in 3 days, 2.5x faster, 12 integrations, $1,200 saved, 15 percent.';
    const f = checkNumericClaims(t);
    expect(f.map(x => x.quoted_text)).toEqual(['40%', '3 days', '2.5x', '12 integrations', '$1,200', '15 percent']);
    for (const x of f) { expect(x.outcome).toBe('cannot_verify'); expect(x.explanation).toBe('Figure needs checking against approved facts.'); expect(t.slice(x.span_start!, x.span_end!)).toBe(x.quoted_text); }
  });
  it('ignores bare numbers, years and numbers inside words', () => {
    expect(checkNumericClaims('Founded 2019, version 3, A4 paper, mp3 files')).toEqual([]);
  });
  it('handles empty text', () => { expect(checkNumericClaims('')).toEqual([]); });
});

describe('alt text', () => {
  it('flags missing or blank alt text only', () => {
    expect(checkAltText(null)).toHaveLength(1); expect(checkAltText('  ')).toHaveLength(1); expect(checkAltText('Team photo')).toEqual([]);
  });
});

describe('contrast (WCAG relative luminance)', () => {
  it('matches known reference values', () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 6);
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 6);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 6);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#0000FF', '#FFFFFF')).toBeCloseTo(8.59, 2);
    expect(contrastRatio('bad', '#FFFFFF')).toBeNull();
  });
  it('flags below 4.5:1 and shows the ratio without rounding up', () => {
    const f = checkContrast('#777777', '#FFFFFF');
    expect(f).toHaveLength(1); expect(f[0]!.explanation).toContain('4.47:1');
    expect(checkContrast('#767676', '#FFFFFF')).toEqual([]);
    expect(checkContrast('#1F2A44', null)).toEqual([]);
  });
});

describe('CIE76 Delta E', () => {
  it('converts sRGB to Lab with D65 reference values', () => {
    const w = rgbToLab([255, 255, 255]); expect(w[0]).toBeCloseTo(100, 2); expect(w[1]).toBeCloseTo(0, 2); expect(w[2]).toBeCloseTo(0, 2);
    const r = rgbToLab([255, 0, 0]); expect(r[0]).toBeCloseTo(53.24, 1); expect(r[1]).toBeCloseTo(80.09, 1); expect(r[2]).toBeCloseTo(67.2, 1);
    expect(rgbToLab([0, 0, 0])).toEqual([0, 0, 0]);
  });
  it('computes Euclidean distance', () => {
    expect(deltaE76([0, 0, 0], [255, 255, 255])).toBeCloseTo(100, 2);
    expect(deltaE76([10, 20, 30], [10, 20, 30])).toBe(0);
  });
  it('flags colours further than 25 from every palette colour and cites the nearest', () => {
    const pal = [{ id: 'p1', name: 'Navy', hex: '#1F2A44' }, { id: 'p2', name: 'Cloud', hex: '#F8FAFC' }];
    const r = checkPalette([{ hex: '#FF0000', share: 0.5 }, { hex: '#F8F8F8', share: 0.5 }], pal);
    expect(r.findings).toHaveLength(1); expect(r.findings[0]).toMatchObject({ quoted_text: '#FF0000', cited_kind: 'palette' });
    expect(r.limitation).toBeNull();
  });
  it('records a limitation rather than inventing results', () => {
    expect(checkPalette([], [{ id: 'p', name: 'n', hex: '#000000' }])).toEqual({ findings: [], limitation: 'No colours could be read from the image.' });
    expect(checkPalette([{ hex: '#000000', share: 1 }], []).limitation).toMatch(/No approved palette/);
  });
});

describe('deterministic sampling', () => {
  const img = (w: number, h: number, px: (x: number, y: number) => [number, number, number, number]) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(px(x, y), (y * w + x) * 4); return d; };
  it('returns the same result for the same pixels, sorted by share', () => {
    const d = img(100, 100, x => x < 75 ? [250, 0, 0, 255] : [0, 0, 250, 255]);
    const a = sampleColours(d, 100, 100); expect(a).toEqual(sampleColours(d, 100, 100));
    expect(a.map(c => c.hex)).toEqual(['#F80808', '#0808F8']); expect(a[0]!.share).toBeCloseTo(0.75, 1);
  });
  it('ignores transparent pixels and invalid sizes', () => {
    expect(sampleColours(img(10, 10, () => [0, 0, 0, 0]), 10, 10)).toEqual([]);
    expect(sampleColours(new Uint8ClampedArray(0), 0, 0)).toEqual([]);
  });
});

describe('span validation and runChecks', () => {
  it('drops findings whose quote does not match the exact version', () => {
    const base = checkBannedTerms('guaranteed', [rule('L', ['guaranteed'])])[0]!;
    const r = validateSpans('guaranteed', [base, { ...base, quoted_text: 'other' }, { ...base, span_end: 99 }]);
    expect(r.kept).toHaveLength(1); expect(r.dropped).toBe(2);
  });
  it('runs text checks for text and image checks for images, with a limitation when the image is unreadable', () => {
    const common = { alt_text: null, text_color: null, background_color: null, rules: [rule('L', ['guaranteed'])], glossary: [], palette: [{ id: 'p', name: 'n', hex: '#000000' }] };
    expect(runChecks({ ...common, type: 'text', body_text: 'guaranteed 40%', colour_samples: null }).findings.map(f => f.check_name)).toEqual(['banned_term', 'numeric_claim']);
    const img = runChecks({ ...common, type: 'image', body_text: '', colour_samples: null, image_error: 'unsupported format' });
    expect(img.findings.map(f => f.check_name)).toEqual(['alt_text']); expect(img.limitations).toEqual(['Palette check not run: unsupported format']);
  });
});
