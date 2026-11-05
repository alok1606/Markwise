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
