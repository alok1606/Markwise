# Phase 1
- [x] Final acceptance recheck: 19 tests passed, eight skipped; reload/logout/invalid callback passed. Minted-fixture refresh rejected; exact real-account/session/mailbox steps documented in audit report.
- [x] Complete comprehensive Phase 1 audit, fix confirmed bugs, and produce A–L results with external blockers; do not start Phase 2.
- [ ] Finish full four-role/two-workspace and expiry/refresh live verification; blocked on authorized role-account fixtures and time-bound session testing.
- [ ] Verify fresh email/Google login, reset mailbox receipt/redemption, branded sender and production redirects; blocked on owner interaction, owned sender domain and publication.
- [x] Authentication, password recovery screens, landing page and profile settings.
- [x] Workspace-isolated foundation, four roles, administrator management and secure navigation.
- [x] Automated and browser verification; completion report with explicit limitations.
- [x] Show the main screens after verification.
- [x] Finish first administrator setup after the requesting user's confirmed signup; owner promoted and administrator screen/readback verified on November 5, 2026.
- [x] Verify Google sign-in, email/password login and password recovery using the owner's real authentication activity and signed-in browser readback.
- [ ] Verify email-signup confirmation with a fresh valid confirmation link (observed signup links were invalid; account confirmation occurred through Google).
- [x] Remove Lovable sign-in from login/signup as requested; retain Google, email/password, verification and recovery without backend changes.
- [x] Run post-change authentication checks: Google request from login/signup, invalid email-login handling, live recovery request, real administrator readback/logout, mobile layout and 15 local tests passed. Fresh successful Google/password login and mailbox redemption require owner interaction; not claimed as retested.
- [x] Reproduce and resolve recoverable protected-redirect page-loading warning; all five signed-out workspace redirects verified without errors.- [x] Workspace switcher: remember last workspace, show role, prefer invited workspace

## Deferred Phase 1 items
- [ ] One-hour session persistence with page refresh (deferred by owner)
- [ ] Full live cross-workspace isolation as each non-Admin role
- [ ] Run 11 skipped live tests with a controlled fixture file

## Phase 2
- [x] Approved by owner and started

## Phase 2 — Brand Knowledge Base
- [x] Schema, RLS, storage, versioning and audit
- [x] Brand profile, guidelines, rules, facts, glossary, visual identity, dashboard
- [x] Admin live browser checks
- [x] Live check: Manager, Reviewer, Creator see "Administrator access required" on /knowledge (owner-performed)
- [x] Live server authorization, RLS and cross-workspace tests run with temporary accounts
- [x] Phase 2 COMPLETE (owner-approved 2026-11-05)

## Phase 3
- [x] Owner approved Phase 3 (2026-11-05 12:17 UTC)
- [x] Phase 3: database (contents, immutable versions, server-side versioning, race protection, audit, private file bucket)
- [x] Phase 3: server functions with real file signature checks
- [x] Phase 3: My Content, New Content (Text/Image/PDF), detail + history, All Content (Manager)
- [x] Phase 3: unit tests + live role/cross-workspace tests with temporary accounts; regression run; progress report
- [x] Phase 3 COMPLETE (owner-approved 2026-11-05)
- [x] Phase 2 privilege hardening (approved; tests re-run, all passed)

## Phase 4
- [x] Implementation plan prepared
- [x] Owner approval of Phase 4 plan
- [x] Owner approved Phase 4 (2026-11-05 12:50 UTC) with 12 extra requirements
- [x] Phase 4: pure checks + unit tests
- [x] Phase 4: reviews/findings schema, atomic server run, duplicate prevention
- [x] Phase 4: findings UI on content detail + counts
- [x] Phase 4: live security tests, end-to-end flow, regression, report
- [x] Phase 4 PDF browser acceptance test
- [x] Phase 4 owner acceptance (2026-11-05 13:17 UTC) — COMPLETE

## Phase 5
- [ ] Phase 5 plan approval (waiting on owner; do not start)
