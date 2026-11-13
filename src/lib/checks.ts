// Phase 4 deterministic checking engine. Pure functions only: no AI, no I/O.
// Offsets are JavaScript string indices (UTF-16 code units), the same units the browser uses to highlight text.

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type CheckName = 'banned_term' | 'terminology' | 'numeric_claim' | 'alt_text' | 'contrast' | 'palette';
export type Finding = {
  check_name: CheckName; category: string; severity: Severity; confidence: number;
  span_start: number | null; span_end: number | null; quoted_text: string; explanation: string;
  cited_kind: 'rule' | 'glossary' | 'palette' | 'wcag' | 'spec'; cited_id: string | null; cited_code: string; cited_passage: string;
  outcome: 'violation' | 'cannot_verify';
};
export type BannedRule = { id: string; code: string; title: string; description: string; severity: Severity; category: string; active: boolean; kind: string; pattern: unknown };
export type GlossaryEntry = { id: string; preferred_term: string; avoided_terms: string[]; case_sensitive: boolean; note?: string };
export type PaletteColour = { id: string; name: string; hex: string };

export const MIN_CONTRAST = 4.5;
export const MAX_DELTA_E = 25;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD = /[\p{L}\p{N}_]/u;

/** Every occurrence of `term` in `text`, with whole-word boundaries on sides where the term begins/ends with a word character. */
export function findOccurrences(text: string, term: string, caseSensitive = false): { start: number; end: number }[] {
  const t = term.trim(); if (!t || !text) return [];
  const pre = WORD.test(t[0]!) ? '(?<![\\p{L}\\p{N}_])' : '';
  const post = WORD.test(t[t.length - 1]!) ? '(?![\\p{L}\\p{N}_])' : '';
  const re = new RegExp(pre + escapeRe(t).replace(/\s+/g, '\\s+') + post, caseSensitive ? 'gu' : 'giu');
  const out: { start: number; end: number }[] = [];
  for (const m of text.matchAll(re)) out.push({ start: m.index!, end: m.index! + m[0].length });
  return out;
}

function termsOf(pattern: unknown): string[] {
  const terms = (pattern as { terms?: unknown } | null)?.terms;
  return Array.isArray(terms) ? [...new Set(terms.filter((x): x is string => typeof x === 'string' && x.trim() !== ''))] : [];
}

/** Check 1: active banned-term rules, every occurrence, citing the rule record. */
export function checkBannedTerms(text: string, rules: BannedRule[]): Finding[] {
  const out: Finding[] = [];
  for (const r of rules) {
    if (!r.active || r.kind !== 'banned_term') continue;
    const seen = new Set<string>();
    for (const term of termsOf(r.pattern)) for (const o of findOccurrences(text, term)) {
      const key = `${o.start}:${o.end}`; if (seen.has(key)) continue; seen.add(key);
      out.push({ check_name: 'banned_term', category: r.category, severity: r.severity, confidence: 1, span_start: o.start, span_end: o.end, quoted_text: text.slice(o.start, o.end),
        explanation: `"${text.slice(o.start, o.end)}" is restricted by ${r.code}: ${r.title}.`, cited_kind: 'rule', cited_id: r.id, cited_code: r.code, cited_passage: r.description, outcome: 'violation' });
    }
  }
  return sortFindings(out);
}

/** Check 2: avoided glossary terms, citing the preferred term. */
export function checkTerminology(text: string, glossary: GlossaryEntry[]): Finding[] {
  const out: Finding[] = [];
  for (const g of glossary) {
    const seen = new Set<string>();
    for (const term of [...new Set(g.avoided_terms)]) for (const o of findOccurrences(text, term, g.case_sensitive)) {
      const key = `${o.start}:${o.end}`; if (seen.has(key)) continue; seen.add(key);
      const q = text.slice(o.start, o.end);
      out.push({ check_name: 'terminology', category: 'terminology', severity: 'medium', confidence: 1, span_start: o.start, span_end: o.end, quoted_text: q,
        explanation: `Use "${g.preferred_term}" instead of "${q}".`, cited_kind: 'glossary', cited_id: g.id, cited_code: g.preferred_term, cited_passage: g.note ?? '', outcome: 'violation' });
    }
  }
  return sortFindings(out);
}

const UNITS = ['%', 'percent', 'per cent', 'x', 'times', 'ms', 'seconds?', 'minutes?', 'hours?', 'days?', 'weeks?', 'months?', 'years?', 'kg', 'g', 'km', 'm', 'cm', 'mm', 'kb', 'mb', 'gb', 'tb', 'users?', 'customers?', 'teams?', 'languages?', 'integrations?', 'countries', 'systems?', 'employees?', 'companies'];
const NUMBER = '\\d+(?:[.,]\\d+)*';
const CLAIM_RE = new RegExp(`(?<![\\p{L}\\p{N}_.,])(?:[$€£₹]\\s?${NUMBER}(?:\\s?(?:k|m|bn|million|billion))?|${NUMBER}\\s?(?:${UNITS.join('|')}))(?![\\p{L}\\p{N}_])`, 'giu');

/** Check 3: percentages, currency amounts and numbers with units. Always provisional: cannot_verify, never a confirmed violation. */
export function checkNumericClaims(text: string): Finding[] {
  if (!text) return [];
  const out: Finding[] = [];
  for (const m of text.matchAll(CLAIM_RE)) {
    const start = m.index!, end = start + m[0].length;
    out.push({ check_name: 'numeric_claim', category: 'claim', severity: 'medium', confidence: 0.5, span_start: start, span_end: end, quoted_text: m[0],
      explanation: 'Figure needs checking against approved facts.', cited_kind: 'spec', cited_id: null, cited_code: 'NUMERIC-CLAIM', cited_passage: '', outcome: 'cannot_verify' });
  }
  return out;
}

/** Check 4: images must have alt text. */
export function checkAltText(alt: string | null | undefined): Finding[] {
  if (alt && alt.trim()) return [];
  return [{ check_name: 'alt_text', category: 'accessibility', severity: 'high', confidence: 1, span_start: null, span_end: null, quoted_text: '',
    explanation: 'The image has no alt text. Add a short description for people using screen readers.', cited_kind: 'wcag', cited_id: null, cited_code: 'WCAG 1.1.1', cited_passage: 'Non-text content needs a text alternative.', outcome: 'violation' }];
}

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return null;
  const n = parseInt(m[1]!, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (rgb: readonly number[]) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const linear = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };

/** WCAG 2.x relative luminance. */
export function relativeLuminance([r, g, b]: [number, number, number]): number { return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b); }
/** WCAG contrast ratio (L1 + 0.05) / (L2 + 0.05), 1 to 21. */
export function contrastRatio(a: string, b: string): number | null {
  const x = parseHex(a), y = parseHex(b); if (!x || !y) return null;
  const [l1, l2] = [relativeLuminance(x), relativeLuminance(y)].sort((p, q) => q - p) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Check 5: contrast between supplied text and background colours. */
export function checkContrast(text: string | null | undefined, background: string | null | undefined): Finding[] {
  if (!text || !background) return [];
  const ratio = contrastRatio(text, background); if (ratio === null || ratio >= MIN_CONTRAST) return [];
  const shown = (Math.floor(ratio * 100) / 100).toFixed(2);
  return [{ check_name: 'contrast', category: 'accessibility', severity: 'high', confidence: 1, span_start: null, span_end: null, quoted_text: `${text.toUpperCase()} on ${background.toUpperCase()}`,
    explanation: `Contrast ratio is ${shown}:1; normal text needs at least ${MIN_CONTRAST}:1.`, cited_kind: 'wcag', cited_id: null, cited_code: 'WCAG 1.4.3', cited_passage: 'Text needs a contrast ratio of at least 4.5:1.', outcome: 'violation' }];
}

/** sRGB (D65) -> linear RGB -> CIE XYZ (IEC 61966-2-1 matrix) -> CIE L*a*b* with the D65 reference white. */
export function rgbToLab([r, g, b]: readonly [number, number, number]): [number, number, number] {
  const R = linear(r), G = linear(g), B = linear(b);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const Y = (0.2126729 * R + 0.7151522 * G + 0.072175 * B) / 1.0;
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/** CIE76 colour difference: Euclidean distance in L*a*b*. */
export function deltaE76(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const x = rgbToLab(a), y = rgbToLab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

export type ColourSample = { hex: string; share: number };
/**
 * Deterministic dominant-colour sampling from RGBA pixels: visits a fixed 64x64 grid of pixel positions,
 * skips mostly transparent pixels, quantises each channel to 16 levels (bucket centre), and returns buckets
 * covering at least `minShare` of sampled pixels, sorted by share then hex. Same pixels in, same colours out.
 */
export function sampleColours(data: ArrayLike<number>, width: number, height: number, max = 8, minShare = 0.03): ColourSample[] {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) return [];
  const grid = 64, counts = new Map<string, number>(); let total = 0;
  for (let gy = 0; gy < grid; gy++) for (let gx = 0; gx < grid; gx++) {
    const x = Math.min(width - 1, Math.floor((gx + 0.5) * width / grid)), y = Math.min(height - 1, Math.floor((gy + 0.5) * height / grid));
    const i = (y * width + x) * 4; if ((data[i + 3] ?? 0) < 128) continue;
    const q = [data[i]!, data[i + 1]!, data[i + 2]!].map(v => (v >> 4) * 16 + 8); const hex = toHex(q);
    counts.set(hex, (counts.get(hex) ?? 0) + 1); total++;
  }
  if (!total) return [];
  return [...counts].map(([hex, n]) => ({ hex, share: n / total })).filter(c => c.share >= minShare)
    .sort((a, b) => b.share - a.share || a.hex.localeCompare(b.hex)).slice(0, max);
}

/** Check 6: image colours further than MAX_DELTA_E from every approved palette colour. */
export function checkPalette(samples: ColourSample[], palette: PaletteColour[]): { findings: Finding[]; limitation: string | null } {
  const pal = palette.map(p => ({ ...p, rgb: parseHex(p.hex) })).filter((p): p is PaletteColour & { rgb: [number, number, number] } => !!p.rgb);
  if (!pal.length) return { findings: [], limitation: 'No approved palette colours exist, so image colours were not compared.' };
  if (!samples.length) return { findings: [], limitation: 'No colours could be read from the image.' };
  const findings: Finding[] = [];
  for (const s of samples) {
    const rgb = parseHex(s.hex); if (!rgb) continue;
    let best = pal[0]!, dist = Infinity;
    for (const p of pal) { const d = deltaE76(rgb, p.rgb); if (d < dist) { dist = d; best = p; } }
    if (dist > MAX_DELTA_E) findings.push({ check_name: 'palette', category: 'visual', severity: 'medium', confidence: 1, span_start: null, span_end: null, quoted_text: s.hex,
      explanation: `${s.hex} (about ${Math.round(s.share * 100)}% of the image) is ${dist.toFixed(1)} Delta E from the nearest approved colour, ${best.name} ${best.hex.toUpperCase()}; the limit is ${MAX_DELTA_E}.`,
      cited_kind: 'palette', cited_id: best.id, cited_code: best.name, cited_passage: best.hex.toUpperCase(), outcome: 'violation' });
  }
  return { findings, limitation: null };
}

function sortFindings(f: Finding[]) { return f.sort((a, b) => (a.span_start ?? 0) - (b.span_start ?? 0) || (a.span_end ?? 0) - (b.span_end ?? 0) || a.cited_code.localeCompare(b.cited_code)); }

/** Drops any finding whose quoted text does not match the exact version text at its UTF-16 offsets. */
export function validateSpans(text: string, findings: Finding[]): { kept: Finding[]; dropped: number } {
  const kept = findings.filter(f => f.span_start === null ? f.span_end === null : (f.span_end !== null && f.span_start >= 0 && f.span_end <= text.length && f.span_end > f.span_start && text.slice(f.span_start, f.span_end) === f.quoted_text));
  return { kept, dropped: findings.length - kept.length };
}

export type CheckInput = {
  type: 'text' | 'image' | 'pdf' | 'docx' | 'pptx'; body_text: string; alt_text: string | null; text_color: string | null; background_color: string | null;
  rules: BannedRule[]; glossary: GlossaryEntry[]; palette: PaletteColour[]; colour_samples: ColourSample[] | null; image_error?: string | null;
};
/** Runs all applicable checks for one exact content version. */
export function runChecks(i: CheckInput): { findings: Finding[]; dropped: number; limitations: string[] } {
  const limitations: string[] = []; let findings: Finding[] = [];
  if (i.type !== 'image') findings = [...checkBannedTerms(i.body_text, i.rules), ...checkTerminology(i.body_text, i.glossary), ...checkNumericClaims(i.body_text)];
  else {
    findings = [...checkAltText(i.alt_text), ...checkContrast(i.text_color, i.background_color)];
    if (!i.colour_samples) limitations.push(`Palette check not run: ${i.image_error || 'the image colours could not be read in this browser.'}`);
    else { const p = checkPalette(i.colour_samples, i.palette); findings.push(...p.findings); if (p.limitation) limitations.push(p.limitation); }
  }
  const v = validateSpans(i.body_text, findings);
  return { findings: v.kept, dropped: v.dropped, limitations };
}
