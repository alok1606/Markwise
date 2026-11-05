# Markwise — Round 2 Scope Assessment and Readiness Report (5 Nov 2026)

Event: CodeNexus India 2026. Assessment only; no application code, database, permissions or deployment changed. Phase 7A–7D not started.

## Part A — Task 9: remaining features

### A1. Insights dashboard — UNFINISHED (out of Round 2 scope, owner preference)
- **Status:** not implemented. No page, no server function, no calculations. The sidebar link was removed in Task 1b so no dead link is shown.
- **Reusable:** findings, reviews, finding_actions and approvals tables; `listWorkspaceContent` (Manager read of submitted content); access helpers in `src/lib/access.ts`; app shell, cards and badge UI; the pure-function + live-test pattern used in Tasks 6–7.
- **Missing:** a workspace-scoped aggregate server function; pure calculation module (findings by category and owner, open vs decided, AI citation-valid share, dropped/downgraded counts, rules dismissed 3+ times with reasons); the page with empty states; nav entry.
- **Effort:** about 6–8 hours including tests.
- **Security:** Admins cannot read content or findings by design. Showing Insights to Admins requires an aggregate-only function that returns counts and rule codes, never content text, titles or quotes. Dismissal reasons are free text written by Creators and may need to be Manager-only. Must be checked so no workspace can see another's numbers.
- **Testing:** unit tests for each calculation; live tests for cross-workspace denial and for each role (Admin sees counts only; Creator/Reviewer denied); browser check including empty state.
- **Round 2 necessity:** not necessary. Can remain unfinished if clearly documented.

### A2. Guideline import assistant — UNFINISHED (out of Round 2 scope, owner preference)
- **Status:** not implemented. The Knowledge Base Guidelines tab only stores uploaded files.
- **Reusable:** Admin-only KB server functions (`saveRecord`, `registerFile`, `getKnowledge`); AI gateway caller with injectable model (`ai-gateway.server.ts`); the "AI output is untrusted" validation pattern in `ai-review.ts` (exact-quote checking); KB rule/fact/glossary forms.
- **Missing:** paste/PDF text intake; prompt and structured-output schema for proposed rules/facts/glossary; server check that every proposal quotes the pasted text exactly; Confirm/Edit/Discard review screen; nothing saved until confirmed; AI-call logging.
- **Database finding:** the AI call log requires a content ID and version ID for every record, so import calls cannot be logged without a schema change (make those fields optional or add a call type). That needs separate approval.
- **Effort:** about 8–12 hours including tests, plus the schema change.
- **Security:** Admin-only on every step; pasted guidelines are sent to the AI provider (must be disclosed on the AI page); proposals must never be saved automatically; confirmed facts should enter as pending, never auto-approved.
- **Testing:** unit tests for proposal validation (invented quotes rejected); simulated AI failure tests without credits; live tests that non-Admins and other workspaces are denied; browser run of Confirm/Edit/Discard. Live AI runs consume credits.
- **Round 2 necessity:** not necessary. Can remain unfinished if clearly documented.

**Recommendation:** agree with owner preference — keep both out of Round 2, list both as unfinished in the README and submission. Both remain in the approved Phase 7.0-extended plan, built only after the three Round 3 commitments, and dropped first if time is short.

## Part B — Consolidated Round 2 readiness

### Phases 1–6
| Phase | Status |
|---|---|
| 1 Foundation, auth, roles, workspaces | Accepted; 3 profile tests pending a real signed-in session |
| 2 Knowledge Base (Admin-only) | Complete |
| 3 Content creation, immutable versions | Complete |
| 4 Automatic checks | Complete |
| 5 AI review engine | Complete |
| 6 Review actions and approval workflow | Complete |

### Round 2 polish tasks
| Task | Result |
|---|---|
| 1 / 1b Dashboard next steps; Insights link hidden | Done |
| 2 Reviewer display name | Left as "Workspace member" (privacy rules unchanged, per owner) |
| 3 Nimbus demo end-to-end + demo page | Done — `Nimbus_Demo_E2E_Report.md`, 17 screenshots |
| 4 README | Done |
| 5 Live check | Done on preview — `Live_Check_Report_2026-11-05.md`, 32 screenshots |
| 6 Activity tab | Done |
| 7 Admin AI-call log | Done |
| 8 Public "How Markwise uses AI" page | Done (`/how-ai-works`) |
| 9 Scope assessment | This report |

### Nimbus demo evidence
Full Creator → Reviewer flow on "We cut onboarding time by 60%, guaranteed!": LEGAL-03 and FACT-014 cited, suggestion accepted, three versions kept, Reviewer approval, cross-role/workspace access denied. Evidence in `docs/evidence/nimbus-demo/`. AI wording varies between runs.

### Documentation
README (13 sections incl. AI/no-code disclosure and honest skipped-test note), phase reports 1–6, Project_Status, Phase_7_Plan (planned, not implemented), demo and live-check reports, evidence folders (nimbus-demo, live-check, ai-call-log, ai-page).

### Test results (latest full suite, 5 Nov 2026 16:46 UTC)
| Passed | Failed | Skipped |
|---|---|---|
| 134 | 0 | 143 |

Skipped = live database/security suites that run only when temporary test accounts are provisioned. They were run and passed when provisioned during their tasks: knowledge 59/59, content 18/18, findings 10/10, approval 9/9, activity 8/8, AI-call log 11/11. Phase 6 final full regression with fixtures: 245 passed, 0 failed, 3 skipped. The 3 Phase 1 profile tests remain unrun (not counted as passed).

### Known limitations
- Insights dashboard and guideline import assistant not built.
- Reviewers see Creators as "Workspace member".
- Cited knowledge-base passages are visible to anyone allowed to read that content (documented; owner decision pending).
- Automatic check may still flag a number as "needs checking" after AI confirms it.
- AI results vary; review takes ~10–20 s; no separate OCR; AI duration not recorded.
- Failed automatic-check attempts not stored as records.
- 402/429 AI errors only simulated.
- Workspace isolation with real content not re-tested on the live check (no data creation allowed).
- Custom email domain not configured. Vercel deployment not verified.

### Remaining blockers before Round 2 submission
1. **Publish the app** — needs owner approval; no public URL exists yet.
2. **Citation-wording decision** (Task 4 options 1/2/3) — owner decision.
3. Run a short smoke check on the published URL after publishing.
4. Submission form items (repo link, video/screenshots, team details) — owner to supply.
