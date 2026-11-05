import { describe, expect, it } from 'vitest';
import { canCreateContent, canTransition, canViewWorkspaceContent, checkContentFile, contentFieldsSchema, contentPathPattern, fieldsForType, isEditable, sniffMime, TEXT_LIMIT } from '@/lib/content';

const base = { title: 'Launch post', channel: 'Web', audience: '', goal: '', body_text: '', alt_text: null, text_color: null, background_color: null };
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const pdf = new TextEncoder().encode('%PDF-1.7\n');
const exe = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]);

describe('content permissions', () => {
  it('only creators create content', () => { expect(['creator', 'manager', 'reviewer', 'admin'].filter(r => canCreateContent(r as never))).toEqual(['creator']); });
  it('only managers view all workspace content', () => { expect(['creator', 'manager', 'reviewer', 'admin'].filter(r => canViewWorkspaceContent(r as never))).toEqual(['manager']); });
});
describe('lifecycle', () => {
  it('allows only draft to submitted in Phase 3', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
    expect(canTransition('submitted', 'draft')).toBe(false);
    expect(canTransition('draft', 'approved')).toBe(false);
    expect(canTransition('submitted', 'approved')).toBe(false);
  });
  it('only drafts are editable', () => { expect(isEditable('draft')).toBe(true); expect(isEditable('submitted')).toBe(false); });
});
describe('fields', () => {
  it('requires a title', () => { expect(contentFieldsSchema.safeParse({ ...base, title: '  ' }).success).toBe(false); });
  it('limits text to 50,000 characters', () => {
    expect(contentFieldsSchema.safeParse({ ...base, body_text: 'a'.repeat(TEXT_LIMIT) }).success).toBe(true);
    expect(contentFieldsSchema.safeParse({ ...base, body_text: 'a'.repeat(TEXT_LIMIT + 1) }).success).toBe(false);
  });
  it('accepts only six-digit HEX colours', () => {
    expect(contentFieldsSchema.safeParse({ ...base, text_color: '#1f2a44' }).data?.text_color).toBe('#1F2A44');
    expect(contentFieldsSchema.safeParse({ ...base, text_color: 'navy' }).success).toBe(false);
  });
  it('images keep empty alt text so the checker can flag it; others drop image fields', () => {
    expect(fieldsForType('image', { ...base, alt_text: null }).alt_text).toBe('');
    expect(fieldsForType('text', { ...base, alt_text: 'x', text_color: '#000000' })).toMatchObject({ alt_text: null, text_color: null });
  });
});
describe('file signatures', () => {
  it('detects real types from bytes', () => { expect(sniffMime(png)).toBe('image/png'); expect(sniffMime(pdf)).toBe('application/pdf'); expect(sniffMime(exe)).toBeNull(); });
  it('rejects a renamed executable', () => { expect(checkContentFile('image', exe, 100, 'png')).toMatch(/Unsupported/); });
  it('rejects a PDF uploaded as an image and mismatched extensions', () => {
    expect(checkContentFile('image', pdf, 100, 'png')).toMatch(/Unsupported/);
    expect(checkContentFile('pdf', pdf, 100, 'png')).toMatch(/do not match/);
  });
  it('enforces 10 MB images and 20 MB PDFs', () => {
    expect(checkContentFile('image', png, 10 * 1024 * 1024 + 1, 'png')).toMatch(/too large/);
    expect(checkContentFile('pdf', pdf, 20 * 1024 * 1024, 'pdf')).toBeNull();
    expect(checkContentFile('pdf', pdf, 20 * 1024 * 1024 + 1, 'pdf')).toMatch(/too large/);
  });
  it('accepts valid files', () => { expect(checkContentFile('image', png, 100, 'png')).toBeNull(); });
});
describe('storage paths', () => {
  const ws = '11111111-1111-1111-1111-111111111111', id = '22222222-2222-2222-2222-222222222222';
  it('requires workspace/content/uuid.ext', () => {
    expect(contentPathPattern(ws, id).test(`${ws}/${id}/33333333-3333-3333-3333-333333333333.png`)).toBe(true);
    expect(contentPathPattern(ws, id).test(`${ws}/33333333-3333-3333-3333-333333333333.png`)).toBe(false);
    expect(contentPathPattern(ws, id).test(`other/${id}/33333333-3333-3333-3333-333333333333.png`)).toBe(false);
  });
});
