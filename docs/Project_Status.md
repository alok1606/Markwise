# Markwise — Consolidated Project Status (2026-11-05 15:17 UTC)

## Phases
| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation, authentication, roles, workspaces | Accepted by owner; 3 profile tests pending |
| 2 | Brand Knowledge Base (Admin-only) + privilege hardening | COMPLETE |
| 3 | Content creation and submission (Text/Image/PDF, immutable versions) | COMPLETE |
| 4 | Deterministic checking engine | COMPLETE |
| 5 | AI review engine | COMPLETE |
| 6 | Review actions and approval workflow | COMPLETE (accepted 2026-11-05 15:17 UTC) |
| 7 | Round 3: accuracy harness, fact-change impact scan, DOCX/PowerPoint review | Plan prepared, awaiting approval — NOT STARTED |

## Latest test evidence (Phase 6 final)
- Full regression: 245 passed, 0 failed, 3 skipped (Phase 1 profile tests needing a real signed-in session; not counted as passed).
- Phase 6: 19 unit, 9 live security/concurrency, Creator/Reviewer and Manager browser end-to-end runs — see Phase_6_Progress_Report.md.

## Outstanding items
Phase 1:
- One-hour session persistence — PASSED (owner manual verification, 2026-11-05 15:17 UTC).
- 3 Phase 1 profile tests needing a real signed-in session — PENDING.
- Full live cross-workspace isolation as each non-Admin role in Phase 1 scope — incomplete (later phases' live suites cover cross-workspace denial for their own data).

Phase 5 limitations:
- Browser error message and "Run AI review" retry not exercised in the browser (simulated AI failure only).
- 402/429 errors simulated, not triggered on the live service.
- No separate OCR engine; image text is as read by the AI.
- AI review takes ~10–20 s; AI results vary between runs.

Phase 6 limitations (accepted, not resolved):
- Failed automatic-check attempts are not independently persisted as records.
- Manager browser approval tested with stand-in AI results, not a naturally clean real-AI result.
- Reviewers see the Creator as "Workspace member" (Phase 1 profile privacy unchanged).

Other:
- Custom email sender domain and branded templates not configured (not a blocker).
- Spec items not yet scheduled: Insights dashboard (7.J), AI transparency page (7.K), guideline import assistant (7.D), demo data (7.L), mandatory end-to-end test (7.M), GitHub/Vercel docs (Part 10).

## Next phase
Phases 1–6 accepted by owner. Phase 7 (Round 3) PLANNED, NOT IMPLEMENTED: final planning baseline approved 5 Nov 2026 15:42 UTC, saved in docs/Phase_7_Plan.md. It covers 7.0 → 7A accuracy harness → 7B DOCX/PPTX → 7C fact-change impact scan → 7D, each with its own approval gate; three mandatory commitments with full acceptance criteria; 300-call accuracy cap; 25-re-review impact batch cap; neutral non-Admin reasons; 72-hour schedule with fallbacks. Implementation waits for owner instruction after the official Round 3 window and deadline are confirmed.
