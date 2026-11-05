# Markwise: Round 1 to Round 3 reconciliation and Phase 7 plan

Planning only. Nothing is built until the owner approves.
Labels used: **[V]** verified in code, data or test reports · **[A]** assumption · **[D]** owner decision needed.

## 1. Requirements across the three rounds

| | Round 1 (proposal) | Round 2 (Pack: what we told judges) | Round 3 (official rules, 10–13 Nov, 72 h, no late window) |
|---|---|---|---|
| Stack | Next.js, FastAPI, pgvector | React/Vite, Lovable Cloud, "edge functions", Gemini Flash, no vectors | Must match reality and be runnable from the repo |
| Promise | Cited, abstaining findings; intent-preserving diffs; guideline-gap insights | 15 "completed" features (Part C) | Finish open features, fix known faults, test main journeys, document |
| Extras | — | Demo-mode role picker, auto-confirm email, landing "Try the demo" | The three named improvements, scored exactly against the Pack wording |

Round 3 scoring [V]: completeness, including saying what is undone (25) · three improvements (20) · reliability with no team help, bad input, empty states and repeats (20) · usability without a walkthrough (20) · docs and credible roadmap (15). Significant AI/no-code tools must be disclosed. Each member files their own role and contribution.

**What changed and why [V]:** the backend runs on TanStack Start server functions, not Edge Functions or FastAPI, because the platform requires it. Signup provisions a Creator workspace and Admins assign roles, so no public role picker and no auto-confirm (security decision in Phase 1). Retrieval still sends the full knowledge base, with no vectors yet. Additions beyond the Pack: workspaces, private storage with file-signature checks, immutable reviews, AI call log, check outcomes with warnings, terminal rejection.

## 2. Round 2 feature audit (Part C list)

| # | Pack claim | Status | Evidence / gap |
|---|---|---|---|
| 1 | Email login, four roles, DB security | 1 Completed and verified | Phase 1 report, live RLS tests, owner role checks. Google sign-in also added |
| 2 | Knowledge base and version history | 1 Completed and verified | Phase 2, 59/59 live RLS. Palette is "visual identity" |
| 3 | Guideline import assistant (AI proposes, admin confirms) | **4 Not implemented** | Guidelines tab only stores files |
| 4 | Text, image, PDF submission with channel/audience/goal | 1 Completed and verified | Phase 3 report, browser PDF acceptance |
| 5 | Deterministic checks (6 kinds) | 1 Completed and verified | checks.ts, 26 unit tests, Phase 4 acceptance |
| 6 | AI check using only approved rules/facts | 2 Implemented, not fully verified | Real AI over-flags neutral text as claims; 402/429 only simulated |
| 7 | Citations validated, invalid ones dropped | 1 Completed and verified | ai-review.ts, 20 unit and 6 live tests |
| 8 | "Cannot verify" outcome | 1 Completed and verified | Phase 4/5 tests |
| 9 | Span-limited diff suggestions | 2 Implemented, not fully verified | Diff in review panel; Edit path not separately browser-tested [A] |
| 10 | Accept / edit / dismiss, reason required | 2 Implemented, not fully verified | Accept and dismiss browser-tested in Phase 6; edit not [A] |
| 11 | Versions never overwritten | 1 Completed and verified | Immutable versions, live tests |
| 12 | Approval routing, comments, **activity log** | **3 Partial** | Routing, decisions and comments verified. No combined Activity tab (audit rows exist, not shown) |
| 13 | Insights dashboard | **4 Not implemented** | Sidebar label exists, no page |
| 14 | "How Markwise uses AI" page + AI call log | **3 Partial** | Call log table exists (Admin data only, no screen). No transparency page |
| 15 | Nimbus Onboard demo data incl. FACT-014/LEGAL-03 | **3 Partial** | Load/remove in KB works. Landing "Try the demo" page is stale Phase 1 text |
| — | Demo-mode role picker, auto-confirm | 4 Not built (deliberate) | Security decision; must be stated honestly |
| — | Full FACT-014/LEGAL-03 end-to-end test | 2 Not recorded as one run | Parts tested separately |
| — | GitHub/Vercel deployment docs | **4 Not implemented** | README is a placeholder |

**Other known faults [V]:** the dashboard still says "Content, reviews and insights are not available yet"; reviewers see the Creator as "Workspace member"; failed check attempts are not stored; no OCR; AI takes 10–20 s; three Phase 1 profile tests are pending; full live cross-workspace isolation is incomplete for Phase 1 (done for Phases 2–6).

## 3. Work order

```text
7.0 Round 2 gap closure  ->  7A Accuracy  ->  7B DOCX/PPTX  ->  7C Impact scan  ->  7D Hardening + submission
```
7.0 comes first because 20 points depend on honest completeness and the Pack listed these as done.

### Phase 7.0: close the Round 2 gaps
- **Insights page** (Manager + Admin, workspace-scoped, computed only from data): findings by category and by owner, open vs decided, AI citation-valid share, dropped-by-validation count, rules dismissed 3 or more times with reasons, plus the "basic version" note and empty states.
- **Guideline import assistant** (Admin): paste text or a PDF, AI returns structured proposals, quotes are checked against the pasted text, Confirm/Edit/Discard, nothing saved until confirmed, calls logged.
- **Activity tab** on each item: read-only timeline from existing audit and approval rows, filtered by existing read access.
- **Public "How Markwise uses AI" page** plus an Admin AI-call log screen.
- **Demo:** rewrite the /demo page with the FACT-014/LEGAL-03 sentence and real steps; record one full end-to-end run.
- Fix the stale dashboard text and show the Creator's name to reviewers.
- Tests: unit tests for the insights calculations and import validation; live tests that the insights and activity data cannot leak across workspaces; browser runs of each screen including empty states.

### Phase 7A: measured accuracy harness (Improvement 1)
- **DB:** eval_datasets, eval_cases (text, expected label clean/flawed), eval_expected_findings (span, category, cited code, expected verdict incl. cannot_verify), eval_runs (mode markwise|baseline, model, prompt hash, seed list, status, cost estimate), eval_case_results, eval_metrics. Admin-only RLS, workspace-scoped; runs and results immutable.
- **Backend:** server function runs a dataset in batches with 429 back-off, resumable. Baseline = same model and prompt with no rules/facts. Matching uses span overlap plus category. Metrics: precision, recall, F1, hallucinated-citation rate, cannot_verify correctness. N repeats per mode give mean, standard deviation and range.
- **Data:** about 40 synthetic, labelled Nimbus cases (roughly half clean, half flawed), clearly marked fictional. Labels are written by hand and are not AI-generated.
- **UI:** Admin "Accuracy" page with dataset viewer, cost estimate and confirm, run progress, side-by-side comparison, per-case drill-down, CSV/JSON export.
- **Tests:** unit tests for the metric maths on hand-computed fixtures; live tests that non-Admin and cross-workspace access is denied and runs are immutable; a browser run of one small run.
- **Accept when:** a real run of both modes, with at least 3 repeats, is stored, rerunnable and shown with variance. Numbers are reported as measured, whatever they turn out to be.

### Phase 7B: DOCX and PowerPoint review (Improvement 3)
- New content types docx and pptx. The browser unzips with JSZip and parses the XML for paragraphs, tables (cell by cell), slide text, speaker notes and image alt text (descr). Each block gets a location (paragraph n, table r/c, slide n, notes, alt text) and a character range in the combined text.
- Creator confirms the extracted text. The server checks ZIP signature, content type and expected parts; file size limits; the original is stored in a private, never-overwritten location.
- Existing deterministic and AI checks run unchanged on the combined text. A pure block-map module converts offsets to "Slide 4 · notes" or "Paragraph 12". Findings show their location and the suggested edit in that block's preview.
- **Tests:** unit tests on fixture .docx/.pptx files (tables, notes, alt text, empty slides, malformed zip, macro-enabled files rejected); live storage tests; a browser upload of each type.
- **Accept when:** a deck with a banned term in speaker notes and a docx with a wrong figure in a table cell both produce correctly located, cited findings, and the originals stay downloadable.

### Phase 7C: fact-change impact scan (Improvement 2)
- **DB:** enable the vector extension. content_chunks (version, block, text, embedding), kb_embeddings, impact_scans (trigger, changed item, old/new hash), impact_flags (content, reason, match type exact|semantic, score, cleared_by, comment), notifications. History tables stay untouched.
- **Flow:** when a fact, rule or glossary entry changes, a scan job runs. Exact matches use old terms, figures and codes. Semantic matches use pgvector similarity above a threshold, over approved and in-progress latest versions. Checks are re-run as **new** review rows, so old reviews, findings and approvals are never changed. Items are flagged "Possibly outdated". The owner and assigned reviewer are notified in the app.
- **Privacy:** non-Admins see a neutral reason ("An approved fact this item relied on was updated"), not the Admin-only wording [D].
- **UI:** flag badge and banner on items, notification bell, Admin impact-scan log, clear flag with a required comment.
- **Tests:** unit tests for exact matching; live tests that cross-workspace scans never touch other workspaces, history stays immutable and notifications reach only the right people; a browser run of editing FACT-014 and seeing the old 40% content flagged.
- **Accept when:** that scenario works end to end, with no change to existing records.

### Phase 7D: hardening and submission
Pass on bad input, empty states and repeated clicks across every main screen; mobile check; first-time help; full regression (skips reported separately); README with setup, architecture and run steps; roadmap; disclosure document.

## 4. Round 3 submission checklist
- [ ] Published URL opens in a private window; judge accounts or signup path documented
- [ ] Public GitHub repo, with a README that lets someone run it
- [ ] Updated product PDF with real screenshots
- [ ] Honest feature list, with the Pack corrections stated (server functions, no role picker or auto-confirm, deferred items)
- [ ] Architecture and implementation summary
- [ ] Evidence for each of the three improvements (stored accuracy run, impact-scan demo, DOCX/PPTX demo)
- [ ] Test results: passed, failed and skipped separately
- [ ] Roadmap and future plan
- [ ] Each member's own role and contribution, written by them. We never draft these for them
- [ ] Disclosure: Lovable (builder and Cloud), Lovable AI Gateway with Gemini model, pdfjs-dist, JSZip, pgvector, TanStack Start, shadcn/ui, Vitest, Playwright

## 5. Owner decisions (approved 5 Nov 2026, planning only)
- **Stack:** keep React/Vite/TypeScript and TanStack Start server functions. No move to FastAPI, Next.js or Edge Functions.
- **Vector extension:** approved. [V] `vector` is listed as available in our Cloud database but not yet installed. Installation is confirmed at the start of 7C.
- **JSZip:** approved for parsing Word and PowerPoint files in the browser.
- **Embedding model:** [V] listed as available today: `google/gemini-embedding-2` (default, text 0.0000008 credits/token, zero retention), `openai/text-embedding-3-small` (0.00000008/token), `text-embedding-3-large`, and legacy `gemini-embedding-001`. [A] Vector size is not shown in the listing. It gets measured with one test call at the start of 7C. If it exceeds the database index limit (2,000), the choice of a smaller-dimension option comes back to you; nothing is changed silently.
- **Accuracy run caps:** default 40 cases × 2 modes × 3 repeats = 240 calls. **Hard cap of 300 AI calls per run, retries included.** Cost estimate plus explicit confirmation before starting. Stops safely when the cap is hit or credits run out (402/403). Partial results are kept, and resuming skips completed case/mode/repeat items.
- **Impact scan caps:** at most 25 AI re-reviews per batch, in resumable batches. Exact matching always runs, even if embeddings or AI fail. Scans record `complete | partial | failed`; a partial scan never reports "no impact".
- **Privacy:** non-Admins see only neutral reasons ("An approved fact this item relied on was updated"). Admin-only knowledge base wording is never exposed.
- **Office files:** never generate edited .docx/.pptx files. The original upload is kept, and suggestions are shown in the app. **Encrypted and macro-enabled files (.docm, .pptm, vbaProject parts, encrypted packages) are rejected.**
- **7.0 scope:** all audit gaps get built and tested (Insights, import assistant, Activity tab, public AI page, Admin AI-call log, demo page + full FACT-014/LEGAL-03 run, dashboard text, reviewer display name, GitHub and deployment docs). Any remaining limitation gets reported, not hidden.
- **Judge access:** the public role picker stays off. Four dedicated demo accounts (Creator, Manager, Reviewer, Admin) in one demo workspace with Nimbus data. Passwords are shared privately through the submission form, never in the repo or docs. The repo only explains how to use the four roles.
- **Gates:** 7.0 → 7A → 7B → 7C → 7D. Each phase gets its own report, test evidence (passed / failed / skipped / partial listed separately), acceptance criteria and your approval. No automatic move to the next phase.

## 5a. Verified dates and 72-hour feasibility
[V] From the official rules: event 2–13 Nov 2026, times in IST. Round 2 runs Wed 4 Nov to Sat 7 Nov (72 h from 10:00). Round 3 runs Tue 10 Nov to Fri 13 Nov: "seventy-two hours from 10:00", so it opens 10 Nov 10:00 IST and closes about 13 Nov 10:00 IST. [A] The rules give no explicit closing clock time for Round 3; confirm it in the organiser's Round 3 email. There is no late window.
[D] Today is 5 Nov, inside the Round 2 window and before Round 3 opens. The rules seen don't say whether work done before 10 Nov counts for Round 3. Please confirm with the Round 2 result email before we rely on early work.

Realistic estimate if everything is done inside the 72 hours:
- **Fits:** 7.0 essentials (Insights, Activity, AI page, AI-call log, demo page, fixes, docs); 7A; 7B for paragraphs, tables, slide text, notes and alt text.
- **At risk:** 7C in full (embeddings, triggers, batching, notifications) on top of the others, plus the 300-call accuracy run time and rate limits.
- **Does not fit comfortably:** all five phases with full live security and browser evidence each, plus the PDF and submission docs.
## 5b. Resolved order and 72-hour schedule
**One order, with no conflict:** the phase sequence stays 7.0 → 7A → 7B → 7C → 7D, each with its own approval gate. To protect the three mandatory improvements, 7.0 is split:
- **7.0-core** (inside the sequence): dashboard text, reviewer name, demo page, judge accounts, Activity tab, Admin AI-call log, public AI page.
- **7.0-extended** (Insights, import assistant): built after 7C. If time is short, these are the ones reported as unfinished.

The three improvements are never reduced. If one can't be finished, it's reported as incomplete against its full acceptance criteria.

Schedule (hours from Round 3 open, 10 Nov 10:00 IST; starts only after the window and deadline are confirmed):

| Hours | Work | Depends on | Gate |
|---|---|---|---|
| 0–8 | 7.0-core + report | — | Owner approval |
| 8–22 | 7A harness, dataset, tests; start the 240-call run | 7.0 gate | Owner approval (run may finish in the background) |
| 22–36 | 7B DOCX/PPTX + tests | 7A gate | Owner approval |
| 36–54 | 7C: dimension check first, then extension, scan, flags, notifications, tests | 7B gate; your choice if the vectors are too large | Owner approval |
| 54–62 | 7.0-extended (Insights, then import assistant) | 7C gate | Owner approval |
| 62–70 | 7D: hardening, full regression, README, disclosure, PDF evidence | all | Owner approval |
| 70–72 | Buffer and submission | — | — |

**Fallbacks, in order:** (1) never trade away security or Phase 1–6 behaviour. (2) Drop the import assistant, then Insights, and report both as unfinished. (3) If 7C slips, deliver exact matching, flags and notifications with a recorded semantic search status, and report the semantic part incomplete. Its acceptance criteria stay unchanged. (4) Shorten approval-gate wait times by sending each report the moment it's ready.

**Precondition:** no implementation until you confirm the official Round 3 window and exact deadline.

## 6. Cost, usage and risks [A: estimates]
- **AI calls:** default accuracy run = 40 cases × 2 modes × 3 repeats = **240 calls**, with a **hard cap of 300 per run including retries**. Impact scans: at most 25 AI re-reviews per batch. Embeddings are very cheap per piece of text (see the listed rates in section 5). Import assistant: about 1 call per document. Credit cost per call depends on draft length and is shown as an estimate before each run.
- **Cloud:** small extra tables. Embedding storage is minor at demo scale. Batch jobs must fit server time limits, so they run in chunks.
- **Risks:** 72 h window with 4 workstreams (7.0 and 7A are highest priority for scoring); AI rate limits during runs; real AI over-flagging will lower the measured precision, which must be reported honestly; complex Office XML (grouped shapes, SmartArt) may be partly unsupported and must be documented; embedding model availability [A]; keeping all Phase 1–6 security unchanged.
