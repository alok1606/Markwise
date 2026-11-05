# Phase 2 — Brand Knowledge Base: progress report (2026-11-05)

## Implemented
| Module | Status | Notes |
|---|---|---|
| 1. Database schema and RLS | Done | brand_profiles, brand_documents, rules, rule_history, facts, fact_history, glossary, palette, brand_fonts, brand_assets; workspace FKs, indexes, Admin-only RLS on every operation, audit triggers, versioning triggers |
| 2. Brand profile | Done | Name, description, industry, website, audience, mission, positioning; validated save/edit |
| 3. Brand guidelines | Done | PDF/DOCX/TXT/MD up to 20 MB in a private bucket; name, upload date, status; download, replace, delete |
| 4. Brand rules | Done | Code, title, description, category, severity, type (mandatory/prohibited/recommended), check kind, pattern, examples, explanation; activate/deactivate; version history |
| 5. Approved facts | Done | Fact ID, title, statement, source, evidence, status (pending/approved/rejected/expired), validity dates, approver name/date, version history. Expired or not-yet-valid facts are never shown as verified |
| 6. Glossary | Done | Approved term, prohibited terms, definition, usage example, case sensitivity, spelling note |
| 7. Assets and visual identity | Done | HEX colours with preview, fonts and guidelines, logos/images (PNG/JPG/WebP up to 10 MB) by category with previews and secure downloads |
| 8. Dashboard | Done | Profile completion, counts, recently updated, empty states, demo load/remove |
| 9. Integration and regression testing | Partial | See below |

## Permissions (from the Master Specification)
Admin: full knowledge-base administration. Manager, Reviewer, Creator: no knowledge-base access (spec Part 4 and Part 7C: "Admin-only area"). Enforced in navigation, in the page, in every server function, and by database RLS and storage policies.

## Demo data
Admin-only, idempotent "Load demo data" adds fictional Nimbus Onboard records: 8 rules (incl. LEGAL-03), 5 approved facts (incl. FACT-014), 4 glossary entries (incl. customers/clients), 5 colours, 1 font, all labelled fictional. "Remove demo data" deletes only demo-flagged rows. Demo data is not currently loaded.

## Test results
- Automated: 45 passed, 0 failed, 22 skipped (11 new live knowledge-base authorization tests + 11 Phase 1 live tests; all need a controlled test-account fixture file).
- Live browser checks as Admin (all passed): menu link; demo load and idempotent reload (8 rules); rule create/edit (v2)/deactivate/history/delete; duplicate code rejected; fact source-required-for-approval, approver recorded, edit of approved statement returns to pending; glossary add/delete; profile validation, save and reload; guideline upload rejection of .exe, PDF upload, download and delete; image upload with preview and delete; demo removal; mobile layout without overflow; zero console errors.
- Database after tests: history and audit rows written; no leftover files in storage.
- Security linter: only the expected warning that signed-in users can call permission-checking functions (each checks Admin internally).

## Not verified
- Manager, Reviewer and Creator denial were not exercised live by signing in as those accounts (enforced by RLS; live tests skipped).
- Cross-workspace knowledge-base isolation not exercised live (admin has one workspace).

## Phase 1 deferred items (unchanged, not passed)
- One-hour session persistence test.
- Full live cross-workspace isolation testing.
- Eleven skipped Phase 1 automated tests.

## Update 2026-11-05 12:00 UTC — non-admin access checks

### User-performed live frontend checks (manual, not automated)
| Role | Direct Knowledge Base URL | Result |
|---|---|---|
| Admin | Access works | PASSED |
| Manager | Blocked, "Administrator access required" | PASSED |
| Reviewer | Blocked, "Administrator access required" | PASSED |
| Creator | Blocked, "Administrator access required" | PASSED |

### Backend authorization (verified by inspection, not by live non-admin calls)
- Markwise has no Edge Functions; all knowledge-base server logic is in authenticated server functions. Every one (getKnowledge, saveBrandProfile, saveRecord, setRuleActive, deleteRecord, registerFile, getFileUrl, getHistory, setDemoKnowledge) calls requireAdmin before any read or write.
- Database: all 10 knowledge tables have RLS policies requiring has_role(auth.uid(), 'admin', workspace_id) on every allowed operation (SELECT/INSERT/UPDATE/DELETE; history tables SELECT only).
- Storage: four admin-only, workspace-path policies on the brand-documents and brand-assets buckets.
- Demo load/remove functions reject non-admins internally.
- NOT live-verified: no direct server/database calls were made as Manager, Reviewer or Creator. The 11 live knowledge-base authorization tests remain skipped (no controlled test-account fixture), and the sandbox cannot impersonate those roles.

### Cross-workspace isolation
INCOMPLETE — enforced by workspace-scoped policies but not exercised live.

### Regression tests
45 passed, 0 failed, 22 skipped (11 Phase 2 live authorization + 11 Phase 1 live tests; all need the fixture file).

### Decision
Phase 2: PENDING. Remaining: live backend denial for non-admin roles, live cross-workspace isolation. Phase 3 not started.

## Update 2026-11-05 12:06 UTC — live backend security verification

### Test setup
Five temporary, email-confirmed test accounts with random passwords were created for this run only: Admin A, Manager, Reviewer and Creator (all members of test workspace A), and Admin B (sole Admin of test workspace B). Each workspace was seeded by its own Admin with rules, facts, glossary entries, a private guideline file and a private logo. Credentials lived only in a private temporary file (owner-read-only), never printed or committed. After testing, all five accounts, both workspaces, their records, audit rows and files were deleted (verified: 0 left). No real accounts, roles or policies were changed.

### Database RLS and storage (automated, real signed-in sessions) — PASSED
`src/test/knowledge-rls-live.test.ts`: 59 passed, 0 failed.
- Admin: reads, updates (history written) and downloads/signs files in own workspace.
- Manager, Reviewer, Creator (each): read 0 rows from all 10 knowledge tables; inserts rejected; updates and deletes by known ID affect 0 rows (record confirmed unchanged); cannot download, sign, upload or delete private guideline/asset files; demo load/remove rejected.
- Cross-workspace (Admin A vs B and B vs A): 0 rows read even by known ID; insert/update/delete rejected or no effect; cannot move own record into the other workspace; cannot download, sign, upload or delete the other workspace's files; demo functions rejected.

### Server authorization (real requests to the running app server) — PASSED
Markwise has no Edge Functions; the Knowledge Base uses authenticated server functions. Each role was signed in in a browser and called them directly.
| Operation | Admin A / Admin B (own) | Manager | Reviewer | Creator |
|---|---|---|---|---|
| Read knowledge base | Allowed | Denied | Denied | Denied |
| Create / update rule | Allowed | Denied | Denied | Denied |
| Version history | Allowed | Denied | Denied | Denied |
| Download guideline | Allowed | Denied | Denied | Denied |
| Save brand profile | Allowed | Denied | Denied | Denied |
| Demo data | Allowed | Denied | Denied | Denied |
| Delete rule | Allowed | Denied | Denied | Denied |
Cross-workspace via server: reading the other workspace denied; updating/deleting the other workspace's rule ID and downloading its file ID through own workspace denied ("not found in this workspace"); passing the other workspace ID denied. Note: Admin B's cross-workspace rule update/delete targeted a rule Admin A had already deleted in the same run, so that specific server check is weak; the database tests above cover it directly. Admin B's cross-workspace file check used a file that still existed.

### Full regression run (fixture not set)
45 passed, 0 failed, 81 skipped. Skipped: 59 new RLS tests, 11 earlier Phase 2 live tests, 11 Phase 1 live tests — all need a controlled test-account file, which is deliberately not stored in the project. The 59 RLS tests were run with a temporary fixture (above). The browser server-function check is a one-off script, not part of the automated suite.

### Decision
Phase 2: PASS for security verification (server authorization, database RLS, cross-workspace isolation). Still carried over, not passed: Phase 1 one-hour session persistence and the 11 skipped Phase 1 live tests. Phase 3 not started.

## Re-run 2026-11-05 12:10 UTC — after type-check fix
A successful build or type check is not treated as security evidence; all checks below were re-executed against the live backend with five fresh temporary accounts (Admin A, Manager, Reviewer, Creator in workspace A; Admin B in workspace B), then fully deleted (0 accounts, 0 workspaces left).
- Database RLS and storage (`knowledge-rls-live.test.ts`, real signed-in sessions): 59 passed, 0 failed, 0 skipped.
- Server authorization (real server-function requests per role): Admins allowed for all 8 own-workspace operations; Manager, Reviewer, Creator allowed for 0 of 13 operations (39 denials).
- Cross-workspace via server: both Admins denied reading, updating, deleting and downloading the other workspace's records and files, by ID and by workspace ID. The earlier weakness is fixed: the delete step now uses a separate record, so cross-workspace targets still existed when attacked.
- Full regression suite (no fixture): 45 passed, 0 failed, 81 skipped (59 RLS + 11 Phase 2 live + 11 Phase 1 live; need a private test-account file that is deliberately not stored in the project).
- The server-function check is a one-off script run, not part of the saved automated suite.

Decision: Phase 2 security verification PASSED. Phase 2 awaits owner acceptance. Phase 1 deferred items unchanged. Phase 3 not started.

## Owner approval 2026-11-05 12:12 UTC
Phase 2 — Brand Knowledge Base: COMPLETE (approved by the project owner).
Carried-over items remain open and are not marked passed: Phase 1 one-hour session persistence (deferred) and 11 skipped Phase 1 live tests.
Phase 3: ON HOLD until the owner explicitly says go.

## Privilege hardening (owner-authorised, 2026-11-05)
Scope: the 10 Knowledge Base tables and the two Knowledge Base storage buckets. No row rules, roles, functions or app behaviour changed.

Before: signed-out (`anon`) and signed-in (`authenticated`) users had every table privilege (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) on all 10 tables. Row rules still blocked non-Admins.

Changes:
- `anon`: all privileges revoked on brand_profiles, rules, rule_history, facts, fact_history, glossary, palette, brand_fonts, brand_documents, brand_assets.
- `authenticated`: TRUNCATE, REFERENCES, TRIGGER, MAINTAIN revoked on all 10 tables.
- `authenticated` on rule_history and fact_history: INSERT, UPDATE, DELETE also revoked (now SELECT only). History rows are written by the database's own versioning triggers, which do not need these.
- `authenticated` keeps SELECT, INSERT, UPDATE, DELETE on the 8 editable tables (Admin-only via unchanged row rules).
- `service_role`: unchanged.

Storage buckets (brand-documents, brand-assets): **no change.** Their four access rules already apply only to signed-in workspace Admins, and the underlying storage table permissions are platform-managed and shared with the avatar and content buckets, so altering them was out of scope and could affect other features.

Verification with 7 temporary accounts across two workspaces (all deleted afterwards, 0 left): Knowledge Base RLS/storage/isolation 59 passed; Knowledge Base authorization 11 passed; content security 18 passed; 0 failed. A first run showed 3 failures caused by missing account IDs in my temporary test file (the demo-data check received an empty workspace ID); after correcting the test file, all 11 passed. Full suite without fixture: 59 passed, 99 skipped.
