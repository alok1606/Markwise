# Phase 4 — Deterministic Checking Engine: progress report (2026-11-05)

Status: **PENDING owner acceptance.** Not marked complete. No AI review, approval decisions, comments, reviewer assignment or Insights were built.

## Implemented
- Six independent pure checks in `src/lib/checks.ts` (no AI, no I/O): banned terms, terminology, numeric claims, image alt text, WCAG contrast, CIE76 palette.
- When a Creator submits, the server runs the checks on the exact submitted version and saves one review with its findings. The content page shows an "Automatic checks" section with highlighted text, grouped findings, citations, contrast ratio, colour swatches and "could not check" notes. My Content and All Content show finding counts.
- Image colours are read in the browser (canvas) and sent as a strictly shaped, untrusted sample used only by the palette check. If the image cannot be read, a limitation is saved and the review is marked partial; no colour findings are invented.
- If checking fails after submission, nothing partial is saved and the owner sees "Run automatic checks" (allowed only while no review exists for that version).

## How the 12 approval requirements are met
1. Each review references the exact `content_version_id`; the database refuses any version other than the submitted one.
2. Offsets are UTF-16 code units (JavaScript string indices, the browser's highlighting units). The server drops any finding whose quote does not match the exact version text at its offsets and records the count.
3. Numeric claims are always `cannot_verify` ("Figure needs checking against approved facts."), shown as "Needs checking".
4. Contrast uses WCAG relative luminance; tested against 21:1, 1:1, #767676 (4.54), #777777 (4.48), #0000FF (8.59). Ratios are shown rounded down so 4.47 never displays as passing.
5. CIE76 Delta E: sRGB → linear RGB → XYZ (IEC 61966-2-1 matrix) → L*a*b* (D65 white). Sampling visits a fixed 64×64 grid on the image drawn at natural size (max 1024 px), quantises channels to 16 levels and sorts by share then hex. Limit 25.
6. Unreadable images record a limitation instead of findings.
7. Review and findings are written in one database transaction; one invalid finding rolls back everything (tested).
8. Reviews and findings are read-only for signed-in users, no access for signed-out users, and immutable (trigger) even for privileged updates.
9. Every rule, glossary and palette citation is checked against the content's workspace inside the database.
10. One review per version (unique constraint and explicit check); a second run is refused.
11. Phase 1–3 suites all re-run and pass.
12. Knowledge Base access unchanged and Admin-only. The server reads only the fields the checks need, after confirming the caller owns the submitted content; Creators/Managers see only the cited rule code, title and description in findings, never Knowledge Base records.

## Database changes
- New `reviews` (content, exact version, workspace, status completed/partial, finding count, dropped count, limitations) and `findings` (spec fields plus check name, citation id, workspace).
- Read rule: same as reading the content (owner Creator; Managers for submitted content in their workspace). Admin and Reviewer: no access (as in Phase 3).
- New server-only `record_review` function (not callable by signed-in users); writes audit event `review_completed`.
- `purge_workspace_content` (cleanup only) now also removes reviews/findings.
- Security finding fixed during testing: the new tables first inherited full default privileges for signed-out and signed-in users (row rules still blocked access). Revoked; now signed-in SELECT only.

## Files changed
- New: `src/lib/checks.ts`, `src/lib/image-colours.ts`, `src/components/content/findings-panel.tsx`, `src/test/checks.test.ts`, `src/test/review-security-live.test.ts`, two database migrations.
- Changed: `src/lib/content.functions.ts` (checks on submit, run-once, findings in detail, counts), `src/routes/_authenticated/content.$id.tsx`, `src/components/content/content-ui.tsx`.

## Test results (actual)
- Unit (`checks.test.ts`): 26 passed — Unicode/emoji offsets, whole-word and punctuation boundaries, case handling, overlapping terms, regex escaping, claims, alt text, contrast references, Lab/Delta E references, deterministic sampling, span validation, empty inputs.
- Live Phase 4 security (7 temporary accounts, two workspaces): 10 passed — exact-version linkage, duplicate refusal, audit, atomic rollback on a cross-workspace citation, drafts/wrong version/other owner/Manager refused, function not callable by any role, no insert/update/delete for any role, read only by owner and same-workspace Manager (second Creator, Reviewer, Admin, other-workspace Admin and Creator see nothing), signed-out denied, Knowledge Base still hidden from non-Admins.
- Browser end-to-end (actual server requests): Creator created and submitted a text item → 4 findings saved and shown (banned term 0–10, terminology 30–37, two claims "Needs checking"); Creator submitted an image → alt-text, contrast 4.47:1 and palette findings (colour read via canvas). Manager saw the same findings and counts, with no run button. Reviewer and Admin saw "Access required"; second Creator and the other workspace's Creator saw "Content not available". No console errors once pages were fully loaded (an earlier run showed request-aborted errors caused by the test navigating mid-load).
- Full suite with temporary accounts: **191 passed, 0 failed, 3 skipped.** Includes Phase 1 database authorization (8), Phase 2 Knowledge Base RLS (59) and authorization (11), Phase 3 content security (18).
- Full suite without accounts: 85 passed, 109 skipped (live suites).
- Skipped: 3 Phase 1 profile-validation live tests, which need a real signed-in session file.
- Two first-run failures were test-setup issues, not product defects, and were fixed in the tests: leftover browser-test data changed expected counts.
- All temporary accounts, workspaces, content, reviews, findings and files deleted (verified 0 left).

## PDF browser acceptance test (2026-11-05, actual)
Seven fresh temporary accounts across two workspaces (Admin, Manager, Reviewer, Creator, second Creator in A; Admin and Creator in B). Workspace A got rule PDF-01 (banned term "guaranteed") and glossary term "customers" (avoid "clients"). Test PDF: one page, text "Our clients enjoy guaranteed onboarding that is 40% faster."
- Upload and browser-side extraction: PASSED — extracted text shown exactly.
- Creator confirmation: PASSED — saving without ticking the confirmation was refused ("Review the extracted text and confirm it before saving."), nothing was saved; after confirming, the draft saved.
- Stored file: `application/pdf`, kept on versions 2 and 3; version 1 has no file.
- Submission: PASSED — status submitted, version 3.
- Checks: PASSED — 3 findings, 0 dropped, status completed: banned term "guaranteed" (18–28, violation, cites PDF-01), terminology "clients" (4–11, violation, cites "customers"), numeric claim "40%" (48–51, **cannot_verify**, shown "Needs checking"). Alt-text/contrast/palette checks do not apply to PDFs.
- Exact version: PASSED — exactly one review, linked to the version 3 record; every finding belongs to it, and every quote matches the saved version 3 text at its offsets.
- Audit: content_created, content_file_uploaded, content_edited, content_submitted, review_completed recorded.
- Browser access: Creator and same-workspace Manager saw the findings (Manager has no run button); Reviewer, Admin and workspace B Admin saw "Access required"; second Creator and workspace B Creator saw "Content not available". No console errors for any role.
- Direct data requests: only Creator and Manager could read the review (1) and findings (3) and download the PDF; Admin, Reviewer, second Creator, workspace B Admin and Creator got 0 rows and file denied; insert and delete refused for all 7 roles; signed-out access refused.
- Regression suite with the temporary accounts: 172 passed, 0 failed, 22 skipped (the Phase 1 live suites using a separate account file and the 3 profile tests needing a session file were not set up for this run; they passed in the earlier Phase 4 run).
- Cleanup: all temporary accounts, workspaces, content, findings and files deleted; verified 0 left.

## Not verified / open
- PDF browser acceptance: completed and passed (see above).
- Palette sampling on JPEG may differ slightly between browsers because of decoder differences; PNG is exact.
- Phase 1 deferred: one-hour session persistence (PENDING/DEFERRED) and 11 skipped Phase 1 live tests (8 of them ran and passed in this run with temporary accounts; 3 still need a session file).
