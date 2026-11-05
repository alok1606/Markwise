# Phase 3 — Content Creation and Submission: progress report (2026-11-05)

Status: **COMPLETE — approved by the owner on 2026-11-05 (12:41 UTC)** on the basis of the implementation and verification results below. No AI review, brand checks, approval workflow or reviewer assignment was built.

## Implemented
- Content items (Text, Image, PDF) with title, type, channel, audience, goal; text up to 50,000 characters with live count; image alt text (may be empty) and optional text/background HEX colours; PDF text extracted in the browser and saved only after the creator confirms it.
- Lifecycle: draft → submitted. Submitted content is locked (no edit, delete or resubmit). Later statuses exist but cannot be set yet.
- Immutable version history: every save, file upload or replacement adds a version; versions cannot be updated or deleted by anyone (database trigger). Deleted drafts are hidden, their versions kept.
- Version numbers are assigned inside the database under a row lock; the client sends only the version it edited, and stale or concurrent edits are rejected (optimistic concurrency). Submission takes the same lock, so an edit cannot land after submission.
- Files: private storage under workspace/content/uuid; upload only into one's own draft; no overwrite or delete, so every historical file stays downloadable from history. The server checks the real file signature (PNG, JPEG, WebP, PDF magic bytes), size limits (10 MB images, 20 MB PDFs) and extension match before registering; rejected files are removed. File registration runs through a privileged function not callable by users.
- Audit events: content_created, content_edited, content_submitted, content_deleted, content_file_uploaded.
- Pages: My Content and New Content (Creator), content detail with history and file downloads, All Content (Manager, submitted only, type filter). Sidebar links unlocked per role; others see "Access required".

## Permissions (as approved)
| | Creator | Manager | Reviewer | Admin |
|---|---|---|---|---|
| Create/edit/delete own drafts, submit | Yes | No | No | No |
| Read own content and history | Yes | — | — | — |
| Read submitted content in own workspace | Own only | Yes (read-only) | No | No |
| Read anyone else's drafts | No | No | No | No |

## Test results (actual)
- Unit tests (`content.test.ts`): 14 passed — permissions, lifecycle, field limits, HEX, file signatures (renamed executable, PDF-as-image, mismatched extension, size limits), storage paths.
- Live database/storage tests (`content-security-live.test.ts`, 7 temporary accounts across two workspaces): **18 passed, 0 failed** on the final run. Covers server-assigned versions, stale and concurrent saves (exactly one wins), save racing submit, direct table writes refused, versions immutable, submitted lock, creator-only creation, private drafts, Manager submitted-only read, deletion hiding, audit events, privileged function blocked, storage upload/read/overwrite/delete rules, and cross-workspace read/update/submit/delete/create/download denial.
- Server requests per role (one-off browser script): Creator allowed on own items only; second Creator, Manager, Reviewer, Admin and a Creator from workspace B denied every action outside their permission, including cross-workspace reads.
- Browser checks (Creator/Manager/Reviewer/Admin): text create → edit (v2) → submit → locked; disguised executable uploaded as PNG rejected by the server; real image saved with preview; image replaced with both files kept in history; PDF text extracted, unconfirmed save blocked, confirmed save stored; Manager sees submitted only; Reviewer and Admin see "Access required"; Admin Knowledge Base and Users still work; mobile has no sideways overflow; zero console errors.
- Activity log after the run: created 20, edited 7, submitted 4, deleted 2, file uploaded 3.
- Full regression (no fixture): 59 passed, 0 failed, 98 skipped. Skipped = live suites that need a private test-account file (18 Phase 3, 59 Phase 2 RLS, 11 Phase 2, 11 Phase 1) — deliberately not stored in the project.
- All temporary accounts, workspaces, content, versions and files were removed afterwards (verified 0 left).

## Findings
- New tables initially inherited broad default privileges (writes were still blocked by row rules). Fixed: content tables are read-only for signed-in users; all writes go through checked functions.
- Phase 2 knowledge tables still carry the same broad default privileges for signed-out and signed-in users. Their row rules deny everything to non-Admins, so nothing is exposed, but tightening them is recommended. Not changed, as Phase 2 security was not to be modified without approval.

## Not verified / open
- Server-request role checks are a one-off script, not part of the saved suite.
- Phase 1 deferred: one-hour session persistence (PENDING/DEFERRED) and 11 skipped Phase 1 live tests.

## Owner acceptance (2026-11-05)
Phase 3 approved as COMPLETE. Evidence preserved above: 14 unit tests passed; 18 live security tests passed; 59 full-suite tests passed; 0 failures; 98 skipped tests documented as unexecuted (fixture-dependent); live per-role and cross-workspace server-request checks. Phase 4 not started.

## Post-acceptance re-run (after Phase 2 privilege hardening)
The 18 content live tests were re-run with 7 fresh temporary accounts: 18 passed, 0 failed. Full suite (no fixture): 59 passed, 0 failed, 99 skipped (one more live test counted in the skipped live suites than the earlier tally; no test was removed).
