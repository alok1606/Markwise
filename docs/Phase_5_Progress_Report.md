# Phase 5 — AI Review Engine: progress report (2026-11-05)

Status: **COMPLETE — accepted by owner (2026-11-05 13:54 UTC)** based on the implementation and test report below. Acceptance does not convert simulated or unverified items into real-world verified results; see "Not verified / open". No approval workflow, finding accept/dismiss, rewrites, comments, reviewer assignment, Insights or AI transparency page were built. Phase 6 has not started.

## Implemented
- After a Creator submits, the server runs the Phase 4 checks, then an AI review of the same exact version. The AI review is saved separately; it never changes Phase 4 findings. If it fails, the submission and Phase 4 findings stand, nothing AI-related is saved, a clear message is shown, and the owner sees "Run AI review" (allowed only while no AI review exists for that version).
- Model: `google/gemini-3-flash-preview` (the Gemini Flash model named in the plan) through Lovable AI, with vision; checked available (zero data retention on this endpoint) before building. Strict structured output. No model change was needed.
- Prompt: the Master Specification system instruction verbatim, plus the workspace's approved sources and formatting rules (prompt version `p5-v2`; `p5-v1` was replaced during testing to add image box format and verdict guidance).
- Context sent to the AI: active rules, approved + active + in-date facts, and glossary of the content's own workspace only, read server-side. The Knowledge Base stays Admin-only everywhere else.
- Text and PDF: the AI reviews the exact saved version text (for PDFs, the Creator-confirmed extracted text).
- Images: the server downloads the exact version's file, fingerprints it (SHA-256, saved on the review), sends it to the vision model, and requires the AI to transcribe visible text. Offsets for image findings refer to that transcription (shown as "Text the AI read in the image"), never to the version text, and each finding needs a valid box (the model's [ymin, xmin, ymax, xmax] 0–1000 format, converted to normalised x/y/width/height). Boxes are drawn on the image.
- New "AI review" section on the content page: verdict (Issue / Contradicted / Supported / Needs checking), severity, category, confidence, verified citation only when confirmed, suggested wording (suggestion only), and "Also flagged by automatic checks" when an AI finding overlaps a Phase 4 finding (presentation only; both records kept).
- AI call log: every attempt (success or failure) recorded with provider, model, prompt version, status, error type and a content-free summary (e.g. "text; 65 characters of submitted text; 1 rules, 1 facts, 1 glossary"). No content, keys or tokens are logged.

## How the 26 approval requirements are met
A. Image evidence
1. Image findings never use version-text offsets; `evidence_kind = image_ocr`.
2. Offsets refer to the AI's transcription of the image; each finding carries a box.
3. The review stores the SHA-256 of the exact version file sent; verified equal to the stored file in testing. The database refuses an image AI review without a fingerprint.
4. Missing/invalid boxes or quotes not in the transcription → cannot_verify without citation (or dropped if the quote is absent).
Limitation: the transcription itself is produced by the AI; there is no separate OCR engine, so image evidence is "as read by the AI", which the page states.

B. Citation validation
5–6. Server validator checks the cited code is in the context actually sent, the source kind matches the verdict (rule/glossary → issue; fact → supported/contradicted), and the cited passage appears in that source's text. The database re-checks workspace, active rule, approved/active/in-date fact, code and passage.
7. Fabricated, inactive, unapproved or mismatched citations are never shown as verified (UI shows "No verified citation").
8. They are downgraded to cannot_verify with the citation removed; dropped and downgraded counts are saved on the review and shown.

C. Review integrity
9. Unique constraint on (version, source) plus a row lock in the recording function; three concurrent runs produced exactly one review.
10. Retry allowed only when no AI review exists; a failed attempt saves none.
11. AI review + findings + success log + audit event (`ai_review_completed`) are written in one transaction.
12. Phase 4 findings verified byte-identical before and after AI reviews and failures.
13. Overlaps are linked in the display only.

D. Reliability
14. AI failure never undoes submission or Phase 4 findings (tested for every failure type).
15. Messages for rate limits, insufficient credits, timeouts, invalid responses, network failures, unsupported files, unavailable model, configuration and save failures.
16. The plan's Gemini model was available; no change made.

E. Security and privacy
17. No change to roles, workspace isolation, existing RLS or server checks. AI reviews/findings use the same read rule as content (owner Creator; same-workspace Manager).
18. Knowledge Base read only server-side inside the review, after confirming the caller owns the submitted content.
19. AI key read only on the server.
20. Logs hold a content-free summary only.
21. AI findings and AI call records are immutable (blocked even for the server role).

## Database changes
- Reviews: now have a source (automatic checks or AI), model, prompt version, image text, image fingerprint and downgrade count. One of each per version.
- Findings: allow AI findings with supported/contradicted outcomes, fact citations, "no citation", suggested wording, image evidence and boxes.
- New AI call log, readable only by that workspace's Admin, written only by the server, immutable.
- New server-only recording function for AI reviews; the Phase 4 recording function was changed only to look for an existing automatic-check review (not any review) and to refuse AI-shaped findings.
- Security finding fixed during the build: the new AI call log first inherited full default permissions for signed-out and signed-in users (row rules still blocked access). Revoked; signed-in users can only read, and only Admins see rows.

## Test results (actual)
- Unit (`ai-review.test.ts`): 20 passed — fabricated quotes, repeated quotes, emoji offsets, fabricated codes, inactive rules, pending/rejected/inactive/expired facts, passage mismatch, wrong source kind, glossary citations, tone without tone rule, invalid schema, clamping/caps, image transcription offsets, image quotes not in transcription, invalid boxes, overlap linking, error mapping.
- Live security/integrity/failure (`ai-review-security-live.test.ts`, 7 temporary accounts, two workspaces, simulated model): 6 passed — exact-version linkage and audit; valid citations kept, fabricated/inactive ones downgraded, fabricated quote dropped; Phase 4 findings unchanged; duplicate refused and exactly one of three concurrent runs saved; rate limit, credits, timeout, network, unavailable and invalid response each saved nothing, were logged as failed, kept Phase 4 findings, and a retry then succeeded; database rejected 7 kinds of invalid citations with nothing saved; only the owner Creator could run it (second Creator, Manager, Reviewer, Admin and other-workspace Creator refused, drafts refused, recording function not callable by any role); AI findings readable only by owner and same-workspace Manager, AI call log only by that workspace's Admin, no insert/update/delete for anyone, immutable even for the server role, signed-out denied, Knowledge Base still hidden from non-Admins.
  - First run: 1 failure caused by my test quoting a word twice that appears once (the app correctly dropped the second quote). Test corrected; all 6 passed on re-runs.
- Real AI failure: a real request with an invalid key was reported as a configuration error.
- Browser, real AI calls (Text, PDF, Image), Creator submitted each:
  - First run (prompt p5-v1): all three saved AI reviews; image findings had no boxes from the AI and were correctly downgraded to "Needs checking"; some text citations were downgraded. Prompt improved.
  - Second run (p5-v2): Text — "guaranteed" issue with verified rule citation, "onboarding in 2 days" contradicted with verified fact citation, "clients" downgraded (the AI mislabelled it). PDF — same two verified findings. Image — both texts found with verified citations and boxes drawn exactly over the words; image fingerprint matched the stored file. All quotes matched the saved text/transcription at their offsets; every finding linked to its review on the submitted version; Phase 4 findings saved alongside.
  - Access: Manager saw all three AI reviews (no run button); Reviewer, Admin and other-workspace Admin saw "Access required"; second Creator and other-workspace Creator saw "Content not available".
  - Console: no errors for Creator, Manager, Reviewer, Admin, second Creator or other-workspace Admin. The other-workspace Creator logged "Failed to fetch" errors from requests cut off when the test moved to the next page (seen before in Phase 4); the page still showed "Content not available".
  - AI results vary between runs (in the first text run the AI also flagged "40%"; in the second it did not). The automatic checks always flag figures.
- Regression (temporary accounts):
  - Run with the content and Knowledge Base account files: **198 passed, 0 failed, 22 skipped**.
  - The 19 Phase 1–2 tests that need a separate account file: a single combined run had 3 test files fail at sign-in before any test ran (most likely the sign-in rate limit from many sign-ins at once). Run separately, they passed: Phase 1 database authorization 8 passed, Phase 2 Knowledge Base authorization 11 passed, plus the Phase 5 live suite 6 passed again.
  - Overall: every test passed in at least one run; **3 skipped** (Phase 1 profile tests needing a real signed-in session file) — not counted as passed.
- Cleanup: all temporary accounts, workspaces, content, reviews, findings, AI call logs, Knowledge Base records and files deleted; verified 0 left.

## Not verified / open
- No failure was triggered in the browser itself, so the on-screen error message and the "Run AI review" retry button were not exercised in the browser. Failure handling was tested against the real database with a simulated AI.
- Insufficient credits (402) and rate limits (429) were simulated, not triggered on the real service.
- No separate OCR engine; image text is as read by the AI.
- A real AI run takes about 10–20 seconds and the submit button waits for it.
- Phase 1 deferred: one-hour session persistence (PENDING/DEFERRED) and 3 Phase 1 profile tests still need a session file.
