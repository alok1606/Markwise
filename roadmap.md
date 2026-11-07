## Admin read-only Reviews (7 Nov 2026)
- [x] Reuse review queue/detail, add Admin sidebar, workspace search/status filters and read-only evidence/history.
- [x] Stage additive authorization migration; owner approved and applied it 7 Nov 2026 (not published).
- [x] Verified: Judge Demo Admin sees all 9 reviewed items read-only; 20 live four-role/isolation/write-denial tests passed; full suite 146 passed/163 skipped. Documented in docs/Admin_Reviews_Read_Only_Report.md.
- [ ] Publish Admin Reviews — waiting on owner instruction.

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
- [x] One-hour session persistence with page refresh — PASSED (owner manual verification, 2026-11-05 15:17 UTC)
- [ ] 3 Phase 1 profile tests needing a real signed-in session — PENDING
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
- [x] Phase 5 plan approved (2026-11-05 13:21 UTC) with 26 extra requirements
- [x] Phase 5: schema (AI reviews, AI call log), validation module + unit tests
- [x] Phase 5: server AI review, UI, live security/failure tests, real browser AI tests, regression, report
- [x] Phase 5 owner acceptance (2026-11-05 13:54 UTC) — COMPLETE

## Phase 6
- [x] Implementation plan prepared
- [x] Plan revised with owner clarifications (2026-11-05 14:01 UTC)
- [x] Final amendments applied (AI gating, shared findings FK, terminal reject, safe backfill)
- [x] Owner approved Phase 6 plan (2026-11-05 14:07 UTC) with clarifications: recoverable Run AI review for missing AI state, Phase 5 retry rules, Manager sees changes_requested read-only
- [x] Phase 6: migration (statuses, AI state, finding actions, approvals, comments, functions, backfill)
- [x] Phase 6: pure modules + unit tests
- [x] Phase 6: server functions + rechecking
- [x] Phase 6: UI (review screen, dialogs, queue, decisions, comments, timeline)
- [x] Phase 6: security, concurrency, browser E2E, full regression, progress report
- [x] Phase 6 owner acceptance — COMPLETE (2026-11-05 15:17 UTC)

## Phase 7
- [x] Phase 7 plan prepared (Round 3 requirements) — awaiting owner approval
- [ ] Phase 7 implementation (not started)

## Phase 7 planning (owner review 5 Nov 2026)
- [x] Owner decisions folded into the Phase 7 plan (caps, privacy, Office rejection, judge accounts, gates)
- [ ] Awaiting explicit owner instruction to begin Phase 7.0 (not started)
- [ ] Confirm Round 3 closing time and early-work eligibility with organisers (owner)
- [x] Final plan corrections: 240/300 call estimate, resolved 72-hour schedule and fallbacks
- [ ] Implementation blocked until owner confirms the official Round 3 window and exact deadline
- [x] Phase 7 plan approved as final baseline (docs/Phase_7_Plan.md); Project_Status updated

## Round 2 polish (requested 5 Nov 2026)
- [x] Task 1 + 1b done (dashboard next steps, Insights removed from menu)
- [x] Task 2: kept "Workspace member" (privacy); Task 3 demo run done, /demo page rewritten
- [ ] Remaining: README, demo, README, live check, Activity, AI-call log, AI page; awaiting owner approval
- [x] Owner approved tasks 1, 1b, 3, 4, 5, 6, 7, 8, 9; task 2 only if privacy-safe without changing rules
- [x] Hackathon name confirmed: CodeNexus India 2026

## Judge Demo Access (CodeNexus India 2026, approved and built 5 Nov 2026)
- [x] Four judge accounts (creator/manager/reviewer/admin) + isolated "Judge Demo — Nimbus Onboard" workspace
- [x] Nimbus demo KB loaded; 9 content items seeded through the real pipeline (draft, checked, pending reviewer, pending manager, approved, changes_requested, rejected, image) — 13 reviews, 30 findings, 5 approvals, 8 AI calls all succeeded
- [x] Verified on production: all four roles sign in; reviewer queue, manager list, admin KB, creator findings all render; judge-creator reads 0 rows from team workspace
- [x] docs/Judge_Demo_Guide.md written (no passwords); credentials delivered to owner via Files only
- [ ] After judging: rotate passwords or delete the four accounts; reset via purge_workspace_content + load_demo_knowledge (owner action)
