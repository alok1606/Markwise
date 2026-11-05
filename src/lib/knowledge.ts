import { z } from 'zod';
import type { Role } from './access';

// The Master Specification makes the knowledge base an Admin-only area; other roles get no access.
export function canManageKnowledge(role: Role) { return role === 'admin'; }

export const ruleCategories = ['legal', 'claim', 'terminology', 'tone', 'visual', 'accessibility'] as const;
export const severities = ['critical', 'high', 'medium', 'low'] as const;
export const ruleTypes = ['mandatory', 'prohibited', 'recommended'] as const;
export const ruleKinds = ['banned_term', 'required_phrase', 'tone_guidance', 'visual'] as const;
export const factStatuses = ['pending', 'approved', 'rejected', 'expired'] as const;
export const assetCategories = ['logo', 'image', 'icon', 'other'] as const;

const text = (max: number) => z.string().trim().max(max);
const required = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max);
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{1,31}$/, 'Use 2–32 capital letters, numbers or dashes, e.g. LEGAL-03');
const optionalDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').nullable().or(z.literal('').transform(() => null));
const termList = z.array(z.string().trim().min(1).max(120)).max(30);

export const brandProfileSchema = z.object({
  brand_name: required('Brand name', 120),
  description: text(2000), industry: text(120),
  website: z.string().trim().max(300).refine(v => v === '' || /^https?:\/\/[^\s]+\.[^\s]+$/.test(v), 'Enter a full web address starting with http:// or https://'),
  target_audience: text(2000), mission: text(2000), positioning: text(2000),
});

export const ruleSchema = z.object({
  code, category: z.enum(ruleCategories), title: required('Title', 160), description: text(2000),
  severity: z.enum(severities), rule_type: z.enum(ruleTypes), kind: z.enum(ruleKinds),
  pattern: z.record(z.string(), z.unknown()).default({}), examples: text(2000), explanation: text(2000), active: z.boolean(),
});

export const factSchema = z.object({
  code, title: required('Title', 160), statement: required('Statement', 1000), source_note: text(1000), evidence: text(2000),
  status: z.enum(factStatuses), valid_from: optionalDate, valid_until: optionalDate, active: z.boolean(),
}).refine(f => !f.valid_from || !f.valid_until || f.valid_until >= f.valid_from, { message: 'Valid until must be on or after valid from', path: ['valid_until'] })
  .refine(f => f.status !== 'approved' || f.source_note.length > 0, { message: 'Approved facts need a source', path: ['source_note'] });

export const glossarySchema = z.object({
  preferred_term: required('Approved term', 120), avoided_terms: termList, note: text(1000), usage_example: text(1000),
  case_sensitive: z.boolean(), spelling_note: text(300),
});

export const paletteSchema = z.object({
  name: required('Colour name', 80), hex: z.string().trim().toUpperCase().regex(/^#[0-9A-F]{6}$/, 'Use a six-digit HEX colour such as #1F2A44'), usage_note: text(300),
});

export const fontSchema = z.object({ name: required('Font name', 80), usage: text(120), guidelines: text(1000) });

export const entitySchemas = { rules: ruleSchema, facts: factSchema, glossary: glossarySchema, palette: paletteSchema, brand_fonts: fontSchema } as const;
export type Entity = keyof typeof entitySchemas;

export const fileRules = {
  document: { bucket: 'brand-documents', maxBytes: 20 * 1024 * 1024, types: { 'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'text/plain': 'txt', 'text/markdown': 'md' } as Record<string, string>, label: 'PDF, DOCX, TXT or Markdown up to 20 MB' },
  asset: { bucket: 'brand-assets', maxBytes: 10 * 1024 * 1024, types: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>, label: 'PNG, JPG or WebP up to 10 MB' },
} as const;
export type FileKind = keyof typeof fileRules;

const extensionTypes: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain', md: 'text/markdown', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
/** Browsers often leave Markdown types blank; fall back to the extension. */
export function fileType(name: string, type: string) { return type || extensionTypes[name.split('.').pop()?.toLowerCase() ?? ''] || ''; }
export function validateUpload(kind: FileKind, file: { name: string; type: string; size: number }): string | null {
  const rule = fileRules[kind]; const type = fileType(file.name, file.type);
  if (!rule.types[type]) return `Unsupported file type. Use ${rule.label}.`;
  if (file.size <= 0) return 'The file is empty.';
  if (file.size > rule.maxBytes) return `The file is too large. Use ${rule.label}.`;
  return null;
}
export function storagePathPattern(kind: FileKind, workspaceId: string) {
  const exts = [...new Set(Object.values(fileRules[kind].types))].join('|');
  return new RegExp(`^${workspaceId}/[0-9a-f-]{36}\\.(${exts})$`);
}

/** Only approved, active, in-date facts may be presented as verified. */
export function effectiveFactStatus(f: { status: string; valid_until: string | null; valid_from?: string | null }, today = new Date().toISOString().slice(0, 10)) {
  if (f.status === 'approved' && f.valid_until && f.valid_until < today) return 'expired';
  if (f.status === 'approved' && f.valid_from && f.valid_from > today) return 'pending';
  return f.status as (typeof factStatuses)[number];
}
export function isVerifiedFact(f: { status: string; active: boolean; valid_until: string | null; valid_from?: string | null }, today?: string) {
  return f.active && effectiveFactStatus(f, today) === 'approved';
}

const profileFields = ['brand_name', 'description', 'industry', 'website', 'target_audience', 'mission', 'positioning'] as const;
export function profileCompletion(p: Partial<Record<(typeof profileFields)[number], string>> | null) {
  if (!p) return 0;
  return Math.round(profileFields.filter(k => (p[k] ?? '').trim().length > 0).length / profileFields.length * 100);
}
