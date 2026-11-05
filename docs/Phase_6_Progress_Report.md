# Phase 6 — Review Actions and Approval Workflow: progress report (2026-11-05)

Status: **IMPLEMENTED — PENDING owner acceptance.** Not marked complete. Phase 7 has not started.

Approved plan: owner approval 2026-11-05 14:07 UTC, with clarifications (recoverable "Run AI review" for missing AI state; Phase 5 retry and duplicate rules; Managers see changes-requested items read-only; Phase 1–5 behaviour preserved unless an additive change is documented).

## What was built
- **Lifecycle** (enforced in database functions): draft → submitted → checked → pending_manager / pending_reviewer → approved / changes_requested / rejected. changes_requested → (revise, new version) → submitted. approved and rejected are final (rejected cannot be resubmitted).
- **Checked stage**: a deterministic review with status `completed` moves content from submitted to checked. A `partial` review (limitations, e.g. palette colours unreadable) keeps it in submitted.
- **Finding actions** (owner Creator, `checked` only, latest version only): Accept (suggested text exactly), Edit (own replacement), Dismiss (reason 3–1000 characters). Accept/Edit create a new immutable version, move it back to submitted and re-run the existing Phase 4 checks and Phase 5 AI review. Dismissal never deletes the finding; the reason is visible to Creator, Manager and assigned Reviewer. One action per finding. Image findings and findings without a text span are dismiss-only. For PDFs, rewrites change the confirmed text, not the original file.
- **Gate**: only unresolved high/critical findings (excluding AI "supported") block sending for approval.
- **AI safety**: send-for-approval is refused while the latest version's AI state is pending (no AI review and no logged failed attempt). If AI failed, sending is allowed with a visible warning; the approval stores `ai_state_at_routing = failed`. Once a version is routed, recording an AI review for it is refused, so late AI findings can never change routing. Missing AI state is recoverable through the existing "Run AI review" button (now available in submitted and checked), following Phase 5's one-review-per-version rule.
- **Routing** (server-side, latest checked version, deterministic + AI findings including dismissed ones): any claim or legal category or cannot_verify outcome → named Reviewer, validated as holding the reviewer role in the same workspace and not the Creator; otherwise → Manager (any supplied reviewer ID ignored).
- **Decisions**: Manager decides manager-routed items; only the assigned Reviewer decides reviewer-routed items; nobody decides their own content; comment always required for Reviewers and for changes_requested/rejected. Stale versions, decided approvals and duplicates are refused.
- **Approval history**: each cycle is a new immutable approval record (actor, time, version, route, decision, comment). Threaded, append-only comments. Audit events for every action, routing, decision and comment.
- **UI**: two-column review screen (content with underlined highlights for the exact version; findings with Accept/Edit/Dismiss, diff of original vs proposed, required-reason dialog), Send for approval panel (route explanation, blocking count, AI pending/failed states, reviewer picker), decision panel, approval history, comments, Reviewer "Review Queue" page, status filter on All Content, new status labels.

## Database migrations
- `0013_phase6_content_statuses`: adds `checked`, `pending_manager`, `pending_reviewer` (`changes_requested`, `rejected` already existed; `in_review` marked deprecated).
- `0014_phase6_review_actions_approvals`: new tables `approvals`, `finding_actions` (single `finding_id` → shared `findings`), `comments` — SELECT-only for signed-in users, no anon, RLS via `can_read_content`; immutability triggers (purge-only deletion); functions `is_assigned_reviewer`, `ai_state` (internal), `approval_route_facts`, `act_on_finding` (service-role only), `submit_for_approval`, `decide_approval`, `add_comment`; verified text patches to `submit_content`, `save_content_draft`, `set_content_file` (also allow changes_requested), `record_review` (advance to checked when completed), `record_ai_review` (allowed in submitted/checked; refused once routed); `contents_guard` (changes_requested editable via functions; approved/rejected final); `can_upload_content_file` (changes_requested); `purge_workspace_content` clears Phase 6 tables; backfill of submitted → checked only where the latest version has a deterministic review with status `completed` (0 rows matched: no content existed).
- `0015_phase6_fix_reviewer_validation`: reviewer validation reads the role table directly (`has_role` only answers for the signed-in user; found by the live tests).
- `0016_phase6_record_review_duplicate_message`: keeps Phase 4's "already ran" answer for a second review of checked content.

**Documented additive access changes**: `contents_read` policy and `can_read_content` gain "or assigned reviewer" (owner and manager conditions unchanged); this extends to versions, reviews, findings and files that already use `can_read_content`. No other policy was loosened. Design deviation: AI state is derived from existing immutable records (AI review saved / failed call logged) instead of a separate state table; behaviour matches the plan.

## Tests
- Unit (`approval.test.ts`): **15 passed** — transitions incl. terminal states, gate, routing, AI-pending/failed blockers, comment and reason rules, threading, emoji-safe rewrites, word diff.
- Live Phase 6 (`approval-security-live.test.ts`, 9 temporary accounts, two workspaces): **7 passed** — manager route and approval; reviewer route with cross-workspace/non-reviewer/self reviewer refused; only the assigned reviewer reads and decides; Manager cannot decide reviewer items and sees changes_requested read-only; revise + resubmit creates a new cycle with history kept; rejection final; AI pending blocks, failed allowed and recorded, late AI result refused; high findings block; dismissal needs a reason and keeps the finding; edit creates a rechecked version with v1 findings unchanged; act_on_finding not callable by signed-in users; Data API writes refused; decided approvals and comments immutable even for the service role; audit rows; parallel sends/decisions/finding actions each succeed once.
- Browser end-to-end (real AI): Creator submitted text with "Guaranteed" and "40%" → checked; Accept on the AI suggestion created v2, rechecked automatically; remaining findings dismissed with reasons; sent to a named Reviewer; second Reviewer saw "Content not available"; Manager saw no decision panel; Reviewer queue listed it; Reviewer requested changes with a comment; Creator revised (v3) and resubmitted; Reviewer approved; comments posted and shown; a second item was rejected by the Reviewer and the page updated without reload. No console errors.
- Regression (temporary accounts, run sequentially to avoid sign-in rate limits): full suite **155 passed, 0 failed**; Phase 5 live suite **6 passed** (run separately after a sign-in timeout and a leftover test rule from that timed-out run were cleaned); Phase 2 KB RLS **59 passed**; Phase 1 database + Phase 2 KB authorization **19 passed**. Total **239 passed, 0 failed, 3 skipped** (Phase 1 profile tests needing a real signed-in session file — not counted as passed). One Phase 5 assertion expected the word "submitted" in the draft-refusal message; the message was adjusted to keep it ("runs only on submitted or checked content"); no test was edited.
- Typecheck and preview build passed. All temporary accounts, workspaces, content, approvals, comments, actions and rules deleted; verified 0 left.

## Owner review amendments (2026-11-05, after first report)
1. **Deterministic check outcomes.** completed = all applicable checks produced a result; completed_with_warnings = checks finished but at least one could not produce a result (stored as review status `partial`, unchanged from Phase 4); failed = the checking process saved nothing for the latest version.
   - completed_with_warnings now moves content to checked. The panel shows "Completed with warnings", lists each incomplete check and why, and states that an incomplete check is not a pass. All findings and results are kept.
   - Any incomplete check forces Reviewer routing. All current checks cover legal, factual, brand or accessibility risk (banned terms, terminology, numeric claims, alt text, contrast, palette), so every limitation is treated as material.
   - Each approval now records `check_outcome`, `check_limitations` and `route_reasons`. These are shown in the decision panel and approval history, included in the audit event, and protected by the immutability trigger.
   - The high/critical unresolved-finding gate is unchanged and still applies with warnings (live-tested).
   - failed: content stays at Checking; sending for approval is refused in the database ("automatic checks have not finished"). The supported recovery is the existing owner-only "Run automatic checks" retry (Phase 4, one review per version). Nothing is bypassed.
   - AI failure handling is unchanged (separate path, Phase 5 behaviour).
   - Migration `0017_phase6_check_outcomes`: three additive approval columns (with defaults); updated immutability guard, `record_review`, `approval_route_facts` (adds outcome/limitations/reasons) and `submit_for_approval`. Backfill: submitted content whose latest version already had a `partial` review becomes checked (0 rows).
2. **Severity sorting.** Both findings panels now list findings Critical → High → Medium → Low (stable within a severity). Check type and category stay visible as badges. Automatic and AI findings remain in separate panels, because Phase 5 requires them to stay distinct.
3. **Manager browser end-to-end (passed).** Content was prepared through the real database functions with a fake "no issues" AI result, because the real AI flags almost any text as a claim. The Creator then sent each item from the browser. Results:
   - The All Content filter "Awaiting manager" listed the 3 manager-routed items and not the reviewer item.
   - The Manager approved one item (Approved), requested changes on one with a comment (Changes requested) and permanently rejected one with a comment (Rejected).
   - On the reviewer-routed item (sent with check warnings), the Manager saw no decision panel. Server refusal is covered by the live tests.
   - The Creator saw Approved / Changes requested / Rejected / Awaiting reviewer.
   - The assigned Reviewer saw the incomplete-check list in the decision panel and the routing reason in the history.
   - No console errors. Database rows confirmed each decision, comment, outcome, limitation and reason.
4. **Amendment test results.**
   - Unit: 19 passed (15 earlier plus 4 new: outcome mapping, warnings force reviewer, failed blocks while the gate is unchanged, severity order).
   - Phase 6 live: 9 passed (7 earlier plus 2 new: warnings route to a reviewer with the limitation/reason recorded and immutable; warnings keep the high/critical gate; failed checks block sending until a successful retry).
   - Full regression, run sequentially with temporary accounts: 216 passed, 1 failed, 22 skipped. The failure was a 5-second test timeout in the Phase 2 knowledge base RLS suite, which then passed 59/59 on rerun with a longer timeout. 19 of the skipped tests (Phase 1 database and Phase 2 knowledge base authorization) needed an account-list fixture; they then passed 19/19.
   - **Final: 245 passed, 0 failing after rerun, 3 skipped** (Phase 1 profile tests needing a real session file; not counted as passed).
   - Typecheck passed. Temporary accounts and data were deleted, with 0 left.

## Not verified / open
- Manager-route browser test used a fake AI result: the real AI flags most text as a claim, so in practice most content will need a Reviewer.
- A checking-process failure is not stored as its own record; it is shown as missing results with the retry button.
- Reviewers see the Creator as "Workspace member" because Phase 1 profile visibility was not widened.
- AI review latency (10–20 s) applies to every new version from Accept/Edit/resubmit.
- Phase 1 deferred: one-hour session persistence (PENDING/DEFERRED) and 3 Phase 1 profile tests.
