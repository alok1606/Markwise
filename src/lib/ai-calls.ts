// Pure helpers for the Admin AI-call log. Browser-safe.
export const AI_CALL_PAGE_SIZE = 20;
export const aiCallStatuses = ['all', 'succeeded', 'failed'] as const;

export type AiCallRow = { id: string; created_at: string; content_id: string; content_version_id: string; provider: string; model: string; prompt_version: string; status: string; error_kind: string | null; what_was_sent_summary: string };

/** Short, non-content identifier for a content item (Admins cannot read content titles by design). */
export const shortRef = (id: string) => `#${id.slice(0, 8)}`;

export function statusTone(status: string): 'good' | 'bad' | 'other' { return status === 'succeeded' ? 'good' : status === 'failed' ? 'bad' : 'other'; }

const ERRORS: Record<string, string> = { rate_limited: 'Rate limited', credits: 'Out of AI credits', timeout: 'Timed out', invalid_response: 'Invalid AI response', network: 'Network error', unsupported_file: 'Unsupported file', unavailable: 'AI service unavailable', configuration: 'Configuration error', save_failed: 'Result could not be saved', already_reviewed: 'Already reviewed', refused: 'Request refused' };
export const errorLabel = (kind: string | null) => (kind ? ERRORS[kind] ?? kind : null);

/** Characters that would change PostgREST filter syntax are removed from search text. */
export const cleanSearch = (q: string) => q.replace(/[^\w\s.\-]/g, ' ').trim().slice(0, 80);
export const pageCount = (total: number) => Math.max(1, Math.ceil(total / AI_CALL_PAGE_SIZE));
export const clampPage = (page: number, total: number) => Math.min(Math.max(1, Math.floor(page) || 1), pageCount(total));
