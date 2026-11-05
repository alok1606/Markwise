# Phase 7 — Round 3 improvements (plan for owner approval)

Status: PLAN ONLY. Nothing below is built. Phases 1–6 stay as they are, except for the additive changes listed here.

## Sources and gaps
- The saved Master Specification does not mention "Round 2" or "Round 3", and no separate Round 2 roadmap document has been supplied. This plan uses the Master Specification and the three Round 3 requirements as you stated them. If you share the Round 2 roadmap, I will reconcile the plan with it before implementation starts.
- These specification items are still unbuilt and are **not** part of this plan unless you add them: Insights dashboard (7.J), AI transparency page (7.K), guideline import assistant (7.D), demo data (7.L), the mandatory end-to-end test (7.M) and the GitHub/Vercel documentation (Part 10).
- Technology stack: no change. TanStack Start server functions stay in place of Edge Functions (already agreed), Lovable Cloud database/storage and the Lovable AI review model from Phase 5. Two new items need your approval: the PostgreSQL `vector` extension (available, not yet installed) and a browser library for reading Word and PowerPoint files (see Requirement 3).

## Existing vs new
| Area | Exists (Phases 1–6) | New in Phase 7 |
|---|---|---|
| Checks | 6 deterministic checks; AI review with validated citations and `cannot_verify` | Measured accuracy of both, with a no-guidelines baseline |
| Facts/rules | Admin-only CRUD, history, fact approval | Impact scan when they change; outdated flags; notifications |
| Content types | Text, Image, PDF (browser extraction) | DOCX and PPTX with paragraph/slide anchors |
| Search | None | pgvector embeddings + exact matching |
| Notifications | None | In-app notifications for content owners and assigned reviewers |

---

## Requirement 1 — Measured Accuracy Harness

**Features and workflow.** An Admin opens a new "Accuracy" page (Admin only) and manages a labelled dataset. Each case holds:
- a draft (clean or flawed)
- the brand context it is judged against: a fixed snapshot of rules, facts and glossary
- the expected findings: category, severity, exact span or quote, expected outcome (violation / contradicted / supported / cannot_verify) and the expected citation

The Admin starts a run, choosing the dataset version and a mode:
- Markwise: deterministic checks plus AI with guidelines
- Baseline: the same AI model and prompt structure, but with no brand guidelines and no citation validation

Results stay viewable and can be exported (CSV/JSON).

**Metrics** (computed in pure, unit-tested code):
- Precision, recall and F1, overall and per category and severity. A finding matches an expected one when the category matches and the spans overlap (or the quote matches exactly).
- Hallucinated-citation rate: citations the model returned that do not exist in, or are not supported by, the sources sent. Reported both before and after Markwise validation.
- `cannot_verify` correctness: precision and recall on cases labelled "unverifiable".
- Clean-draft false-positive rate.
- Baseline vs Markwise difference for each metric.

**Reproducibility.** Every run stores:
- dataset version and hash, model ID, prompt version, mode
- code version (commit)
- the raw model output and a per-case hash
- the repeat count, with each case run N times (default 3) to report spread
- the deterministic part of the score, which must be identical between reruns

AI variance is shown as a range, never hidden. A seed dataset of about 40 cases (20 flawed, 20 clean) will be written for a fictional brand and **clearly labelled synthetic**. The headline result is never presented as a real-world accuracy claim.

**Database (new, Admin-only, workspace-scoped).**
- `eval_datasets` (versioned, immutable once used)
- `eval_cases`
- `eval_expected_findings`
- `eval_runs` (status, settings, hashes)
- `eval_case_results` (raw output, matches)
- `eval_metrics` (stored computed values)

Results are immutable. Grants and RLS follow the Knowledge Base pattern.

**Backend and AI.**
- Runs execute on the server in small batches with a progress record, honouring 429 back-off and stopping (not retrying) on 402/403.
- The baseline uses a separate prompt version and its own logging, so it never affects real content.
- Every AI call is logged to `ai_calls` with a distinct purpose.

**UI.**
- Dataset list and editor, with span selection for expected findings
- Run launcher with a cost estimate
- Results page: metric tables, a Markwise-vs-baseline comparison, and per-case drill-down showing expected vs found

**Security.** Admin only. Dataset text never goes into real content tables. Run cost is capped per run and per day (configurable).

**Dependencies.** Phase 4 checks and the Phase 5 AI review (same validators, reused through injection), Phase 2 Knowledge Base structures (for snapshots), and the AI call log.

**Tests.**
- Unit: matching, precision/recall/F1, hallucination rate, `cannot_verify` scoring, edge cases (no expected findings, no predictions).
- Integration: a fake-model run gives exact known metrics, and reruns give identical deterministic scores.
- Security: non-Admins and other workspaces are denied, and results cannot be changed.
- Browser: create a case, run it with the fake model, view the results.

**Acceptance criteria.**
- Metrics on the fake model match hand-computed values.
- One real run of Markwise and baseline completes and is stored with all reproducibility fields.
- A rerun from the stored settings reproduces the deterministic scores exactly and reports the AI spread.

**Risks and costs.**
- A real run costs about (cases × repeats × 2 modes) AI calls; for example 40×3×2 = 240 calls. A cost estimate is shown and confirmation is required before a run starts.
- Synthetic data may not reflect real brands.
- The span-matching rules affect the scores, so they will be documented.

---

## Requirement 2 — Fact-Change Impact Scan

**Features and workflow.**
- When an Admin approves, edits, retires or deletes a fact, or creates, edits or deactivates a rule or glossary entry, a scan job is queued for that workspace.
- The scan finds affected content in Approved, Checked, Awaiting manager/reviewer and Changes requested status (latest version only). It uses two methods:
  - **Exact:** term and pattern matching for banned terms, glossary and numeric values in the old and new wording.
  - **Semantic:** pgvector similarity between the changed item's old and new text and stored chunks of each content version, above a tuned threshold.
- For each hit, the relevant checks are re-run on that version: the affected deterministic checks, plus an AI re-review when it involves facts or claims.
- Results go into a new **impact review record**. Existing Phase 4–6 reviews, findings, approvals and versions are never changed.
- Content with any new high/critical or contradicted finding is marked **Possibly outdated**, with the reason and the triggering change.
- The content owner and the assigned reviewer (if any) receive an in-app notification.
- Approved content is not automatically un-approved. A human decides: the Creator opens a new revision (new version → normal workflow), or a Manager/Reviewer clears the flag with a required comment.

**Database.**
- Enable the `vector` extension.
- `content_chunks`: version-scoped chunks with offsets and an embedding, written by the server only.
- `kb_embeddings`: embeddings for facts, rules and glossary entries.
- `impact_scans`: trigger, old/new snapshot, status, counts.
- `impact_hits`: content, version, method (exact/semantic), similarity score, re-check result.
- `content_flags`: possibly_outdated, reason, cleared_by and comment, immutable history.
- `notifications`: recipient, type, link, read_at; only the recipient can read it or mark it read.
- Triggers on the Knowledge Base tables enqueue scans. Scan processing uses locked SECURITY DEFINER functions, following the existing pattern.

**Backend and AI.**
- Embeddings use the gateway's default embedding model, at the full dimensions confirmed at implementation, with the same model for documents and queries.
- Chunks are created when a version is submitted, and backfilled for existing versions.
- Scans run in a job, triggered on change and by a scheduled sweep for retries. Each batch is bounded, and the job pauses on 402/403.
- Exact checks always run, even if embedding fails. A partial scan is recorded as partial, never as "no impact".

**UI.**
- "Possibly outdated" badge and reason on content pages and lists, plus an impact panel showing the triggering change and the new findings.
- Notification bell with a list.
- Admin "Impact scans" log on the Knowledge Base page.
- Clear-flag dialog requiring a comment.

**Security.**
- Admins see scan logs for their workspace only.
- Content flags are visible to the users who can already read that content (`can_read_content`).
- Notifications are visible to the recipient only.
- Knowledge Base text stays Admin-only; content pages show only the change summary needed to explain a flag. You will need to approve whether a fact's new wording can be shown to Creators and Reviewers, because the Knowledge Base is currently Admin-only.

**Dependencies.** Phase 2 triggers and history, Phase 3 versions, Phase 4/5 checks, and Phase 6 statuses and reviewer assignment.

**Tests.**
- Unit: chunking with offsets, exact matching, threshold logic, flag rules.
- Integration: changing a fact flags the matching approved content and notifies the owner and reviewer; unrelated content is not flagged; embedding failure still runs the exact checks and marks the scan partial.
- Security: notifications and flags across roles and workspaces; flags and scan records cannot be changed.
- Concurrency: two quick fact edits produce consistent scans.
- Browser: Admin edits a fact; Creator sees the badge and notification; Manager clears the flag with a comment.

**Acceptance criteria.**
- On a prepared set, every content item containing the changed figure or term is flagged (exact recall 100%).
- The semantic threshold is reported with measured precision and recall on a small labelled set.
- No Phase 4–6 record is changed.

**Risks and costs.**
- Embedding cost for each version and each Knowledge Base item (small).
- AI re-review cost for each hit.
- Semantic threshold tuning, and false positives.
- Large workspaces need batching.
- Not real-time: the scan delay will be stated.

---

## Requirement 3 — DOCX and PowerPoint Review

**Features and workflow.**
- Creators upload a `.docx` or `.pptx` file, up to the existing size limits.
- The browser extracts its structure:
  - **DOCX:** paragraphs in order, with headings, tables flattened to paragraphs, and image alt text.
  - **PPTX:** per slide, the title, body text boxes, speaker notes and image alt text.
- As with PDFs, the Creator reviews and confirms the extracted text before saving.
- The server checks the file's real signature (ZIP plus the expected internal parts) and registers it through the existing service-role function.
- Checks and the AI review run on a combined text that records each block's location (paragraph N, or slide N with its part: title, body, notes or alt). Every finding is anchored to its block and an offset inside the block.
- The review screen shows the document as paragraphs or a slide-by-slide outline, with findings and suggested edits shown in place.
- Accept/Edit rewrites the confirmed extracted text and creates a new version, as with PDFs. The original file is kept unchanged.
- Generating an edited .docx or .pptx file is out of scope unless you request it.

**Database.**
- Add `docx` and `pptx` to the content type and allowed file types.
- `content_versions.blocks` (jsonb, immutable): each block's ID, kind, location and offsets.
- `findings.block_id` (nullable): checked in the database to match the version's blocks.
- Storage policy and registration function extended to the new types and signatures.

**Backend and AI.**
- Pure block-mapping module, with unit tests, that converts offsets between combined text and blocks.
- The AI prompt receives block labels; the validator re-derives the block from the offsets and never trusts a block returned by the AI.
- Alt-text accessibility check extended to images inside the documents.

**Library choice (needs approval).** A browser ZIP/XML reader, such as `jszip` with custom parsing, or `mammoth` for DOCX only. No server-side native libraries (they would not run on the hosting runtime). Embedded images are not OCR'd.

**UI.**
- Upload options for Word and PowerPoint, an extraction review step, the paragraph view and slide outline, and per-block finding markers.

**Security.** Same rules as Phase 3 files: private storage, Creator-only uploads into their own draft, signature checks, no overwrite. Macro-enabled files (`.docm`, `.pptm`) and encrypted files are rejected.

**Dependencies.** Phase 3 upload, registration and versioning; Phase 4/5 checks and validators; Phase 6 actions and anchors.

**Tests.**
- Unit: parsing of fixture DOCX/PPTX files (paragraphs, tables, notes, alt text), block mapping and offsets with emoji.
- Integration: a finding's block and offset reproduces the exact quote; a forged block ID is rejected.
- Security: wrong signature, macro or encrypted file, cross-workspace upload.
- Browser: upload each type, confirm the text, submit, see anchored findings, accept a suggestion.

**Acceptance criteria.**
- For both fixtures, every expected finding appears on the correct paragraph or slide (including notes and alt text), and accepting a suggestion produces a new version with the correct block text.

**Risks.**
- Complex layouts (SmartArt, charts, text in images) are not extracted; this will be shown to the user.
- Very large decks increase AI cost and response time.

---

## Implementation sequence (one sub-phase at a time, each reported for your acceptance)
1. **7A Accuracy harness:** it measures the existing system, and its results act as the baseline for later changes.
2. **7B DOCX/PPTX review:** adds content types that 7C must then cover.
3. **7C Fact-change impact scan:** vector extension, chunk backfill, scans, flags, notifications.
4. Full Phase 1–7 regression and report.

## Decisions needed before starting
1. Approve the `vector` extension and a DOCX/PPTX browser library (jszip-based parsing preferred).
2. Approve AI cost caps for evaluation runs (for example 300 calls per run) and impact re-reviews.
3. Decide whether flagged content may show the changed fact's wording to non-Admins, or only a neutral summary.
4. Confirm generated .docx/.pptx output stays out of scope.
5. Supply the Round 2 roadmap if it exists.

## Technical notes
- New tables follow the existing rules: SELECT-only access through the database API, writes through locked SECURITY DEFINER or service-role functions, immutable records, audit events, explicit grants, no anon access.
- AI calls stay in server-only files with an injectable model caller (testable offline) and are logged to `ai_calls`. Gateway errors are handled as before: 429 back-off; 402/403 pause the job.
- Pure logic (metrics, block mapping, matching) goes in `src/lib` with unit tests. Live tests use temporary accounts, run one after another, and are cleaned up afterwards.
