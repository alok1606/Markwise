import { describe, expect, it } from 'vitest';
import { canManageKnowledge, effectiveFactStatus, factSchema, isVerifiedFact, paletteSchema, profileCompletion, ruleSchema, storagePathPattern, validateUpload, brandProfileSchema } from '@/lib/knowledge';

const ws = '11111111-2222-3333-4444-555555555555';
const fact = { code: 'FACT-014', title: 'Onboarding', statement: 'Reduces onboarding time by up to 40% (2025 customer study).', source_note: '2025 study', evidence: '', status: 'approved', valid_from: '', valid_until: '', active: true };
const rule = { code: 'legal-03', category: 'legal', title: 'No guaranteed', description: '', severity: 'critical', rule_type: 'prohibited', kind: 'banned_term', pattern: { terms: ['guaranteed'] }, examples: '', explanation: '', active: true };

describe('Phase 2 knowledge base permissions', () => {
  it('only admin can manage the knowledge base', () => {
    expect(canManageKnowledge('admin')).toBe(true);
    for (const role of ['creator', 'manager', 'reviewer'] as const) expect(canManageKnowledge(role)).toBe(false);
  });
});

describe('Rules', () => {
  it('normalises codes to capitals', () => expect(ruleSchema.parse(rule).code).toBe('LEGAL-03'));
  it('accepts exactly the four severities', () => {
    for (const severity of ['critical', 'high', 'medium', 'low']) expect(ruleSchema.safeParse({ ...rule, severity }).success).toBe(true);
    expect(ruleSchema.safeParse({ ...rule, severity: 'urgent' }).success).toBe(false);
  });
  it('accepts exactly mandatory, prohibited and recommended types', () => {
    for (const rule_type of ['mandatory', 'prohibited', 'recommended']) expect(ruleSchema.safeParse({ ...rule, rule_type }).success).toBe(true);
    expect(ruleSchema.safeParse({ ...rule, rule_type: 'optional' }).success).toBe(false);
  });
  it('rejects a blank title', () => expect(ruleSchema.safeParse({ ...rule, title: '  ' }).success).toBe(false));
});

describe('Facts', () => {
  it('approved facts need a source', () => expect(factSchema.safeParse({ ...fact, source_note: '' }).success).toBe(false));
  it('pending facts may omit a source', () => expect(factSchema.safeParse({ ...fact, status: 'pending', source_note: '' }).success).toBe(true));
  it('valid until cannot precede valid from', () => expect(factSchema.safeParse({ ...fact, valid_from: '2026-05-01', valid_until: '2026-04-01' }).success).toBe(false));
  it('an approved fact past its end date is expired, not verified', () => {
    const f = { status: 'approved', active: true, valid_until: '2026-01-31' };
    expect(effectiveFactStatus(f, '2026-02-01')).toBe('expired');
    expect(isVerifiedFact(f, '2026-02-01')).toBe(false);
  });
  it('pending, rejected and inactive facts are never verified', () => {
    expect(isVerifiedFact({ status: 'pending', active: true, valid_until: null }, '2026-01-01')).toBe(false);
    expect(isVerifiedFact({ status: 'rejected', active: true, valid_until: null }, '2026-01-01')).toBe(false);
    expect(isVerifiedFact({ status: 'approved', active: false, valid_until: null }, '2026-01-01')).toBe(false);
    expect(isVerifiedFact({ status: 'approved', active: true, valid_until: null }, '2026-01-01')).toBe(true);
  });
});

describe('Visual identity and profile', () => {
  it('stores colours as six-digit uppercase HEX', () => {
    expect(paletteSchema.parse({ name: 'Navy', hex: '#1f2a44', usage_note: '' }).hex).toBe('#1F2A44');
    expect(paletteSchema.safeParse({ name: 'Navy', hex: '#123', usage_note: '' }).success).toBe(false);
  });
  it('requires a brand name and a full website address', () => {
    const base = { brand_name: 'Nimbus Onboard', description: '', industry: '', website: '', target_audience: '', mission: '', positioning: '' };
    expect(brandProfileSchema.safeParse(base).success).toBe(true);
    expect(brandProfileSchema.safeParse({ ...base, brand_name: '' }).success).toBe(false);
    expect(brandProfileSchema.safeParse({ ...base, website: 'example.com' }).success).toBe(false);
  });
  it('reports profile completion across seven fields', () => {
    expect(profileCompletion(null)).toBe(0);
    expect(profileCompletion({ brand_name: 'A', description: 'B', industry: '', website: '', target_audience: '', mission: '', positioning: '' })).toBe(29);
  });
});

describe('Uploads', () => {
  it('accepts PDF guidelines up to 20 MB and rejects larger files', () => {
    expect(validateUpload('document', { name: 'g.pdf', type: 'application/pdf', size: 20 * 1024 * 1024 })).toBeNull();
    expect(validateUpload('document', { name: 'g.pdf', type: 'application/pdf', size: 20 * 1024 * 1024 + 1 })).not.toBeNull();
  });
  it('rejects executables and SVG assets', () => {
    expect(validateUpload('document', { name: 'x.exe', type: 'application/x-msdownload', size: 10 })).not.toBeNull();
    expect(validateUpload('asset', { name: 'logo.svg', type: 'image/svg+xml', size: 10 })).not.toBeNull();
  });
  it('limits assets to 10 MB', () => expect(validateUpload('asset', { name: 'l.png', type: 'image/png', size: 10 * 1024 * 1024 + 1 })).not.toBeNull());
  it('only accepts storage paths inside the workspace folder', () => {
    const re = storagePathPattern('document', ws);
    expect(re.test(`${ws}/0c8a6f0e-1b2c-4d5e-8f90-123456789abc.pdf`)).toBe(true);
    expect(re.test(`99999999-2222-3333-4444-555555555555/0c8a6f0e-1b2c-4d5e-8f90-123456789abc.pdf`)).toBe(false);
    expect(re.test(`${ws}/../other/file.pdf`)).toBe(false);
  });
});
