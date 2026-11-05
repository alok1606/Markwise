# Phase 6 — Review Actions and Approval Workflow (final revised plan, NOT approved)

Sources: Master Specification 7.H, 7.I, Part 4, Part 5 (`approvals`, `comments`), Part 8, Part 9 tests 12–15; owner clarifications (14:01 UTC) and final amendments (14:04 UTC). Planning only — no implementation, no database change until explicit approval.

Schema facts confirmed (read-only): deterministic and AI findings share one `findings` table, linked to one `reviews` table where `source` is `deterministic` or `ai`, unique per (version, source); review `status` is `completed` or `partial`. AI call attempts are logged in `ai_calls` (`succeeded`/`failed`). There is currently no record of "AI review pending" for a version.

## 1. Lifecycle

Existing status values: `draft, submitted, in_review, approved, rejected`. Added: `checked, pending_manager, pending_reviewer, changes_requested`. `rejected` is now used as the terminal rejection. `in_review` stays in the type, marked deprecated, never written.

| Status | Meaning |
|---|---|
| draft | Creator editing (Phase 3, unchanged) |
| submitted | Locked; deterministic checks for latest version running or failed |
| checked | Deterministic review `completed` for latest version; Creator acts on findings; AI may still be pending |
| pending_manager | Sent for approval, Manager route |
| pending_reviewer | Sent for approval, named Reviewer route |
| changes_requested | Returned by approver; Creator may revise and resubmit |
| approved | Final, fully locked |
| rejected | Final, fully locked; no resubmission through the normal workflow |

### Transition table (enforced in database functions; everything else refused)

| From | To | Who | Condition |
|---|---|---|---|
| draft | submitted | Creator (owner) | Phase 3 rules unchanged |
| submitted | checked | System | Deterministic review for latest version recorded with status `completed` (`partial` keeps `submitted`) |
| checked | submitted | Creator via Accept/Edit | New version created; rechecking starts |
| checked | checked | Creator via Dismiss | Action recorded; no new version |
| checked | pending_manager / pending_reviewer | Creator | Latest version checked; AI state for that version terminal (completed or failed); zero unresolved high/critical findings; route computed server-side |
| pending_manager | approved / changes_requested / rejected | Manager, same workspace | Open approval; version is latest; approver is not the Creator; comment required for changes_requested and rejected |
| pending_reviewer | approved / changes_requested / rejected | Assigned Reviewer only | Same, comment always required |
| changes_requested | submitted | Creator | Revision saved as a new version, then submitted for rechecking |
| approved, rejected | — | nobody | Terminal |

Transition changes vs today: Phase 3 `submitted` now advances automatically to `checked`; `save_content_draft` and `submit_content` additionally accept `changes_requested`; `rejected` becomes reachable only via a decision.

## 2. AI completion and routing safety
- New per-version AI state record: `pending` (set when the AI review is started for a version), then `completed` (AI review recorded) or `failed` (attempt failed). Retries move `failed` back to `pending` only while the content is `checked`.
- Entering `checked` does not wait for AI (Phase 5 non-blocking kept).
- `submit_for_approval` refuses while the latest version's AI state is `pending` or missing ("AI review still running"). If `failed`, submission is allowed; the dialog and approvers show a visible "AI review failed — routed on automatic checks only" warning, and the approval record stores `ai_state_at_routing = failed`.
- Freeze: the AI recording function and retry refuse once the version has an approval record or the content is no longer `checked`. Late AI results are logged in `ai_calls` as rejected-late and never inserted as findings, so routing can never change silently. Both functions lock the same content row, so submit and AI recording cannot interleave.

## 3. Rechecking and version linkage
- Accept, Edit and post-change revisions create a new immutable version via existing server-side versioning, then reuse Phase 4 `record_review` and Phase 5 `record_ai_review`. No new checking engine.
- Findings, citations and reviews stay linked to their version and are never modified.
- Finding actions are allowed only on the latest checked version.
- Approval records store `version_id`; decisions refused if a newer version exists.

## 4. Finding resolution
For the latest checked version each finding is: accepted/edited (produced the next version; that version's fresh findings start unresolved), dismissed (reason mandatory; finding row untouched; visible to Creator, Manager and assigned Reviewer with reason, actor, time), or unresolved.
Gate: only unresolved high/critical findings block submit-for-approval. If AI failed, the gate uses deterministic findings only.

## 5. Routing (server-side, latest checked version, deterministic + AI findings including dismissed ones)
- Any claim or legal category, or any `cannot_verify` outcome → `pending_reviewer`. Reviewer ID is validated: member of the same workspace, holds the reviewer role there, not the Creator. Otherwise refused.
- Else → `pending_manager`; any supplied reviewer ID ignored.
- Dismissal never removes Reviewer routing.

## 6. Permissions by role and state

| Action | Creator (owner) | Manager (same ws) | Reviewer | Admin |
|---|---|---|---|---|
| View content/findings/actions | All states | submitted onward (unchanged) | Items with an approval assigned to them (current or past) | Denied (unchanged) |
| Accept/Edit/Dismiss | `checked` only | No | No | No |
| Edit content | `draft`, `changes_requested` | No | No | No |
| Submit for approval | `checked`, AI terminal | No | No | No |
| Decide | Never | `pending_manager` only | Own assignment in `pending_reviewer` | No |
| Comment | Own item, after draft | Items they can view | Assigned items | No |
| Approval history | Own items | Workspace items | Assigned items | No |

Reviewer read access is new and narrow, via security-definer `is_assigned_reviewer(content_id)` added to SELECT policies. No other Phase 1–5 policy is loosened; every policy addition will be listed in the report.

## 7. Database migrations (one migration, additive only)
1. `content_status` enum: add `checked, pending_manager, pending_reviewer, changes_requested`; comment `in_review` deprecated.
2. `ai_review_states`: version_id (unique), content_id, workspace_id, state (`pending|completed|failed`), updated_at. Written only by functions. SELECT for those who can read the content.
3. `finding_actions`: id, workspace_id, content_id, version_id, finding_id (FK → `findings`, single field, no separate AI field), action (`accepted|edited|dismissed`), reason (required for dismissed), final_text, result_version_id (required for accepted/edited), actor_id, created_at. Unique (finding_id). Function validates the finding belongs to the version. Immutable.
4. `approvals`: id, workspace_id, content_id, version_id, route (`manager|reviewer`), reviewer_id (required iff reviewer route), assigned_by, ai_state_at_routing, status (`open|approved|changes_requested|rejected`), decision_comment, decided_by, decided_at, created_at. Partial unique index: one `open` per content. New cycle = new row. Decided rows immutable (open → decided once).
5. `comments`: id, workspace_id, content_id, parent_id (same content), author_id, message (1–4000), created_at. Append-only.
6. Grants for 2–5: SELECT to authenticated, ALL to service_role, none to anon; RLS on; SELECT policies per section 6; no client write policies.
7. Functions: `act_on_finding`, `submit_for_approval`, `decide_approval`, `add_comment`, `is_assigned_reviewer`, AI-state helpers; extensions to `save_content_draft`, `submit_content`, `record_review` (advance to `checked` only when completed) and `record_ai_review` (freeze rule, set AI state). Audit events for every action/decision/comment.
8. Backfill: content in `submitted` moves to `checked` only when its latest version has a deterministic review with status `completed` (not merely any review row). Its AI state is backfilled to `completed` if an AI review exists for that version, else `failed` if a failed AI call for that version is logged, else left missing (Creator must run AI review before routing). No other rows changed; history untouched.

## 8. Server functions and transactions
Each database function is one transaction with `SELECT ... FOR UPDATE` on the content row and checks an `expected_version`:
- `act_on_finding` → dismiss records; accept/edit apply text at verified offsets (text/PDF text; image findings dismiss-only), create version, status `submitted`, then app server runs existing checks + AI.
- `submit_for_approval` → status, AI terminal, gate, routing, reviewer validation, insert approval.
- `decide_approval` → lock content + approval; authorised actor; not Creator; version current; comment rules; set status.
- `add_comment` → access check, insert.
App server functions use authenticated middleware; no direct table writes.
Guarantees: stale versions, duplicate approvals, self-approval, unassigned approval, edit-vs-approval races and late AI findings all refused in the database.

## 9. UI
- Two-column review screen on content detail (underline + icon highlights, severity-sorted findings with category, confidence, quote, explanation, citation, Needs checking, suggested rewrite, actions).
- Accept/Edit dialog with original vs proposed diff; Dismiss dialog with required reason; read-only version history.
- Submit-for-approval dialog: computed route, blocking findings, Reviewer picker only when needed, "AI review running" disabled state, AI-failed warning.
- Reviewer Review Queue; Manager status filter + approval queue; decision panel (approve / request changes / reject with comment); threaded comments; activity timeline. Accessible dialogs and status text.

## 10. Tests
- Unit: transition table incl. terminal states, gate, routing (incl. AI-failed path), text application with Unicode, diff, comment/reason rules.
- Security (temporary accounts, two workspaces, four roles): Reviewer sees only assigned items; Manager cannot decide reviewer route; no self-approval; Creator cannot act outside `checked`, bypass routing or resubmit rejected content; forged/cross-workspace/non-reviewer IDs refused; Admin denied; direct writes refused; immutability; audit rows.
- Concurrency: duplicate decisions, decide vs new version, parallel finding actions, double submit, AI recording vs submit (late AI result refused).
- AI gating: submit refused while pending; allowed with warning when failed; no findings added after routing.
- Migration: backfill only moves content with a completed deterministic review on the latest version; partial/absent stay `submitted`.
- Browser end-to-end: submit → findings → dismiss/accept/edit → recheck → Reviewer and Manager routes → request changes → revise → approve; separate reject path; comments.
- Full regression of Phases 1–5; skipped tests reported separately.

## 11. Implementation sequence
1. Migration (section 7) and verification queries.
2. Pure modules + unit tests.
3. Server functions with rechecking via existing Phase 4/5 code and AI state tracking.
4. UI.
5. Security, concurrency, browser tests, regression, Phase 6 progress report.

## 12. Regression risks
- Changing `record_review`/`record_ai_review` could affect Phase 4/5 behaviour → rerun all Phase 4/5 unit and live suites.
- New statuses may break existing lists, counts and badges (My Content, All Content, Manager visibility "submitted onward") → update filters and test Manager visibility for every new status.
- Reviewer SELECT additions on content, versions, findings and files must not widen access for non-assigned users → explicit negative tests.
- Backfill could mis-state content → limited to completed deterministic reviews, verified by query before/after.
- Freeze rule could reject legitimate AI retries → retries allowed only in `checked`, tested.
- AI latency (10–20 s) per new version delays routing.

## 13. Remaining ambiguities (proposed defaults)
1. Image findings dismiss-only; image changes via changes_requested + replacement upload.
2. Managers cannot reassign the Reviewer in Phase 6.
3. Rejected content: an Admin or Creator may only start new content; no reopen function in Phase 6.

Out of scope: Insights, AI transparency page, guideline import, demo data. Phase 1 deferred items (one-hour session check, 3 profile tests) remain documented. Phase 6 not approved or started.
