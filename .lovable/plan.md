# Phase 5 — AI Review Engine (plan for approval)

Source: Master Specification Part 7 G (AI review engine), Part 5 (`findings`, `ai_calls`), Part 3 (AI). Nothing here is built until you approve.

## What it does
After a Creator submits content and the automatic checks run, Markwise sends that exact version to the AI, together with only the workspace's approved, active rules, facts and glossary. The AI returns structured findings. Every finding is checked by the server before it is saved; anything that can't be proven against the workspace's own sources is downgraded to "Needs checking" with no citation. Results appear in the existing "Automatic checks" area as a separate "AI review" section, clearly labelled as AI.

Humans keep final control: the AI only suggests. Nothing is approved, edited or published automatically. Accepting/dismissing suggestions and approvals are later phases.

## Scope
- Text and PDF (extracted, confirmed text) reviewed by the AI.
- Images: vision review of visible text only, against supplied rules and facts; the page says so.
- Verdict for every numeric/factual claim: supported, contradicted or cannot_verify.
- Tone findings only when an active approved tone rule exists.
- Suggested rewrites stored, shown as suggestions only.
- One AI review per submitted version; a retry is allowed only if the earlier attempt failed and saved nothing.
- Deduplicate AI findings against Phase 4 findings for the same span, keeping all valid source references.
- Understandable messages for rate limits, timeouts, invalid AI responses, insufficient AI credits, network errors and unsupported files; submission and deterministic findings always stand.
- AI call log (provider, model, prompt version, safe summary, status) per call; no keys and no full content in logs.

## Server-side validation (finding rejected or downgraded when)
1. Quoted text is not an exact substring of the version text (offsets computed by the server, never taken from the AI).
2. Cited code doesn't exist in the content's workspace.
3. Cited source is inactive, unapproved (facts) or not part of the material sent for this review.
4. Cited passage is not present in the cited source.
5. Offsets are invalid.
6. The response fails the strict schema (whole response rejected, nothing saved).
Downgraded findings become cannot_verify with no verified citation; the count of rejected/downgraded findings is recorded on the review.

## Permissions (unchanged from Phases 3–4)
- Creator: runs/reads AI review for own submitted content.
- Manager: reads AI findings for submitted content in their workspace.
- Reviewer and Admin: no content access yet (review queue/approval come later).
- Other workspaces and signed-out: no access.
- Knowledge Base stays Admin-only; the server reads it with server privileges only after confirming the caller owns the submitted content.

## Out of scope
Accepting/dismissing findings, applying rewrites, comments, reviewer assignment, approval workflow, Insights, AI transparency page, guideline import assistant.

## Technical details
- Architecture: TanStack Start authenticated server function (`runAiReview`) instead of an `ai-review` Edge Function; same security role (server-only, credentials never in the browser). Called after `submitContent` and via a retry button.
- AI: Lovable AI Gateway, default Gemini Flash model with vision (`google/gemini-3-flash-preview`); tool calling with a strict JSON schema (quoted_text, verdict, category, severity, confidence, explanation, cited_code, cited_passage, suggested_text). If unavailable, stop and ask before switching model. Prompt text = spec system instruction verbatim, versioned (`prompt_version`).
- Pure module `src/lib/ai-validate.ts`: schema parse, span location (first exact match, UTF-16), citation checks, downgrade, dedup against deterministic findings. Fully unit-tested without network.
- DB migration:
  - `reviews`: add `source` ('deterministic' | 'ai'); unique (content_version_id, source) replacing per-version uniqueness, so each version gets one of each.
  - `findings`: reuse table (`source='ai'`, `suggested_text`, `confidence`, verdict mapped to outcome: supported/contradicted/cannot_verify; plus existing violation for rule findings).
  - New `ai_calls` (id, workspace_id, content_id, content_version_id, provider, model, prompt_version, what_was_sent_summary, status, error_kind, created_at); RLS read = Admin of workspace only; writes service-role only; immutable.
  - Extend `record_review` (or new `record_ai_review`) SECURITY DEFINER, service-role only: atomic review + findings + audit `ai_review_completed`; re-validates citations in-workspace and active.
  - Revoke default grants on new table (signed-in SELECT only, signed-out none), as done in Phases 2–4.
- UI: "AI review" section in findings panel with "AI" badge, verdict labels, verified citation only when validated, suggested text, limitation notes and error state with retry.
- Tests:
  - Unit: validation of fabricated quotes, fake codes, inactive/unapproved sources, passage mismatch, bad offsets, invalid schema, dedup, emoji offsets.
  - Live security (temporary accounts, two workspaces): role access, cross-workspace denial, duplicate refusal, atomic rollback, ai_calls Admin-only, immutability, signed-out denial.
  - AI call mocked in tests; one real end-to-end browser run (text, PDF, image) with a real AI call, reported honestly.
  - Full regression of Phases 1–4.

## Acceptance criteria
- Fabricated citations never shown as verified; downgrade counts recorded.
- Numeric claims without approved support are cannot_verify.
- One AI review per version, tied to the exact version; atomic.
- Role and workspace access identical to Phase 4; Knowledge Base still Admin-only.
- Errors show understandable messages; submission and Phase 4 findings unaffected.
- All Phase 1–4 tests still pass; skipped tests reported as skipped.

## Still open from Phase 1
One-hour session persistence (PENDING/DEFERRED) and the remaining skipped Phase 1 live tests.
