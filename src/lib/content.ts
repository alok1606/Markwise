import { z } from 'zod';
import type { Role } from './access';

export const contentTypes = ['text', 'image', 'pdf'] as const;
export type ContentType = (typeof contentTypes)[number];
export const contentStatuses = ['draft', 'submitted', 'checked', 'pending_manager', 'pending_reviewer', 'in_review', 'approved', 'rejected', 'changes_requested'] as const;
export type ContentStatus = (typeof contentStatuses)[number];
export const channels = ['Web', 'Email', 'Social', 'Print', 'Other'] as const;
export const TEXT_LIMIT = 50_000;

// Spec Part 4: Creators create/submit their own content; Managers read submitted workspace content.
// Admin has no content access. Reviewers (Phase 6) see only items assigned to them.
export const canCreateContent = (role: Role) => role === 'creator';
export const canViewWorkspaceContent = (role: Role) => role === 'manager';
export const canReviewAssigned = (role: Role) => role === 'reviewer';

/** Creator submission: from a draft, or resubmitting after changes were requested. Full lifecycle lives in ./approval. */
export function canTransition(from: ContentStatus, to: ContentStatus) { return (from === 'draft' || from === 'changes_requested') && to === 'submitted'; }
export const isEditable = (status: ContentStatus) => status === 'draft' || status === 'changes_requested';

const hex = z.string().trim().toUpperCase().regex(/^#[0-9A-F]{6}$/, 'Use a six-digit HEX colour such as #1F2A44').nullable().or(z.literal('').transform(() => null));
export const contentFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  channel: z.string().trim().max(60), audience: z.string().trim().max(300), goal: z.string().trim().max(500),
  body_text: z.string().max(TEXT_LIMIT, `Text is limited to ${TEXT_LIMIT.toLocaleString()} characters`),
  alt_text: z.string().max(500).nullable(), text_color: hex, background_color: hex,
});
export type ContentFields = z.infer<typeof contentFieldsSchema>;

/** Normalises fields for a type: only images carry alt text and colours; alt text may be empty (the checker flags it later). */
export function fieldsForType(type: ContentType, f: ContentFields): ContentFields {
  if (type === 'image') return { ...f, body_text: '', alt_text: f.alt_text ?? '' };
  return { ...f, alt_text: null, text_color: null, background_color: null };
}

export const contentFileRules = {
  image: { maxBytes: 10 * 1024 * 1024, types: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>, label: 'PNG, JPG or WebP up to 10 MB' },
  pdf: { maxBytes: 20 * 1024 * 1024, types: { 'application/pdf': 'pdf' } as Record<string, string>, label: 'PDF up to 20 MB' },
} as const;

/** Detects the real file type from its first bytes; returns null when the signature is not an allowed type. */
export function sniffMime(bytes: Uint8Array): string | null {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 && b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a) return 'image/png';
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return 'image/webp';
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46 && b(4) === 0x2d) return 'application/pdf';
  return null;
}

/** Validates a file against its content type using the real signature, not the name or browser type. */
export function checkContentFile(type: 'image' | 'pdf', bytes: Uint8Array, size: number, extension: string): string | null {
  const rule = contentFileRules[type]; const mime = sniffMime(bytes);
  if (size <= 0) return 'The file is empty.';
  if (size > rule.maxBytes) return `The file is too large. Use ${rule.label}.`;
  if (!mime || !rule.types[mime]) return `Unsupported file. Use ${rule.label}.`;
  if (rule.types[mime] !== extension) return 'The file contents do not match its type.';
  return null;
}

export function contentPathPattern(workspaceId: string, contentId: string) {
  return new RegExp(`^${workspaceId}/${contentId}/[0-9a-f-]{36}\\.(png|jpg|webp|pdf)$`);
}

export const statusLabel: Record<ContentStatus, string> = { draft: 'Draft', submitted: 'Checking', checked: 'Checked', pending_manager: 'Awaiting manager', pending_reviewer: 'Awaiting reviewer', in_review: 'In review', approved: 'Approved', rejected: 'Rejected', changes_requested: 'Changes requested' };
