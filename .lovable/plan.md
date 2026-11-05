# Phase 6 — Review Actions and Approval Workflow (revised plan, NOT approved)

Sources: Master Specification 7.H, 7.I, Part 4, Part 5 (`approvals`, `comments`), Part 8, Part 9 tests 12–15, plus the owner's seven mandatory clarifications. Planning only; nothing is implemented until explicit approval.

## 1. Lifecycle

Current status values: `draft, submitted, in_review, approved, rejected`. Phase 3 "Submit" locks the draft and starts checking. Phase 6 keeps that lock and adds values (additive enum change; `in_review` and `rejected` stay in the type, marked deprecated, never written).

| Status | Meaning |
|---|---|
| draft | Creator editing (Phase 3, unchanged) |
| submitted | Locked; checks for the latest version running or failed (Phase 3/4/5 behaviour) |
| checked | Deterministic checks recorded for the latest version. Creator acts on findings here |
| pending_manager | Sent for approval, Manager route |
| pending_reviewer | Sent for approval, named Reviewer route |
| changes_requested | Approver returned it; Creator may edit (draft-like editing on a new version) |
| approved | Final; fully locked |

Transition table (all enforced in database functions; anything else is rejected):

| From | To | Who | Condition |
|---|---|---|---|
| draft | submitted | Creator (owner) | Phase 3 rules unchanged |
| submitted | checked | System | Deterministic review recorded for latest version |
| checked | submitted | Creator via Accept/Edit | New version created; rechecking starts |
| checked | checked | Creator via Dismiss | Action recorded; no new version |
| checked | pending_manager / pending_reviewer | Creator | Latest version checked; zero unresolved high/critical findings; route computed server-side |
| pending_manager | approved / changes_requested | Manager of same workspace | Approval record open, version = latest, approver is not the Creator |
| pending_reviewer | approved / changes_requested | The assigned Reviewer only | Same as above; comment mandatory |
| changes_requested | submitted | Creator | Edits saved as a new version, then submitted for rechecking |

"Rejected" in the spec is recorded as decision `rejected` with status `changes_requested` so the Creator can revise; no terminal reject state unless the owner prefers one (see ambiguities).

AI review: runs after deterministic checks as in Phase 5. Moving to `checked` does not wait for AI (AI failure must never block, per Phase 5). Approvers see AI status (done/failed/pending) on the version.

## 2. Rechecking and version linkage
- Accept, Edit and post-change edits each create a new immutable `content_versions` row via existing server-side versioning, then reuse the existing Phase 4 `record_review` path and Phase 5 `record_ai_review` path. No new checking engine.
- Findings, citations, reviews and AI reviews stay tied to the version they were produced for and are never modified.
- Finding actions on an older version are rejected once a newer version exists (actions apply only to the latest checked version).
- Approval records store `version_id`; decisions are refused if the content's latest version differs.

## 3. Finding resolution
Per latest checked version, each finding (deterministic or AI) is:
- resolved_accepted / resolved_edited: an action produced the next version (counts reset on the new version because its findings are fresh).
- dismissed: action with mandatory reason; the finding row is untouched and stays visible to Creator, Manager and assigned Reviewer with the reason, actor and time.
- unresolved: no action.
Gate: submission for approval is blocked only when unresolved findings with severity high or critical exist on the latest checked version. Medium/low never block. `cannot_verify` findings follow their severity for blocking but always force Reviewer routing.

## 4. Routing (server-side)
Computed inside the submit-for-approval function from findings on the latest checked version (deterministic + AI, including dismissed ones):
- Any finding of category claim or legal, or any `cannot_verify` outcome → `pending_reviewer`. Creator must supply a Reviewer; the function verifies the person is a member of the same workspace with the reviewer role and is not the Creator. Otherwise refused.
- Else → `pending_manager`. Any supplied reviewer ID is ignored.

## 5. Permissions by role and state

| Action | Creator (owner) | Manager (same ws) | Reviewer | Admin |
|---|---|---|---|---|
| View content/findings/actions | All states | submitted onward (unchanged) | Only items with an approval assigned to them (current or past) | Denied (unchanged) |
| Accept/Edit/Dismiss findings | `checked` only | No | No | No |
| Edit content | `draft`, `changes_requested` | No | No | No |
| Submit for approval | `checked` | No | No | No |
| Decide | Never (no self-approval) | `pending_manager` only | Own assignment in `pending_reviewer` | No |
| Comment | On own item, any state after draft | Items they can view | Assigned items | No |
| Read approval history | Own items | Workspace items | Assigned items | No |

Reviewer read access is new and narrow: added through a security-definer check `is_assigned_reviewer(content_id)`. Existing Phase 1–5 policies are not loosened; additions will be listed explicitly in the report.

## 6. Database schema
- Enum `content_status`: add `checked, pending_manager, pending_reviewer, changes_requested`.
- `finding_actions`: id, workspace_id, content_id, version_id, finding_id (deterministic) or ai_finding_id (exactly one, CHECK), action (`accepted|edited|dismissed`), reason (required for dismissed, CHECK), final_text, result_version_id (required for accepted/edited), actor_id, created_at. Unique (finding) per version so a finding is acted on once. Immutable trigger.
- `approvals`: id, workspace_id, content_id, version_id, route (`manager|reviewer`), reviewer_id (required iff reviewer route), assigned_by, status (`open|approved|changes_requested|superseded`), decision_comment, decided_by, decided_at, created_at. Partial unique index: one `open` per content. Each new cycle inserts a new row; decided rows are immutable (trigger allows only open → decided once).
- `comments`: id, workspace_id, content_id, parent_id (same content, CHECK via function), author_id, message (1–4000 chars), created_at. Append-only (no update/delete).
- All three tables: GRANT SELECT to authenticated, ALL to service_role, no anon; RLS on; SELECT policies per section 5; no client INSERT/UPDATE/DELETE policies. Audit events written by functions.

## 7. Server/database functions (each one transaction, `SELECT ... FOR UPDATE` on the content row)
- `act_on_finding(content_id, expected_version, finding ref, action, reason, final_text)`: verifies owner, status `checked`, latest version = expected and finding belongs to it; dismiss → record; accept/edit → apply text at verified offsets (text/PDF text only; image findings dismiss-only), create version, set `submitted`, record action, audit. Server then runs existing checks + AI review.
- `submit_for_approval(content_id, expected_version, reviewer_id?)`: status `checked`, gate, routing, reviewer validation, insert approval, set status, audit.
- `decide_approval(approval_id, expected_version, decision, comment)`: locks content and approval; approval open; actor authorised for route; actor ≠ creator; version current; comment required (always for reviewer, and for changes requested); updates approval, sets status, audit.
- `add_comment(content_id, parent_id?, message)`: access check, insert, audit.
- Existing `save_content_draft` extended to allow `changes_requested` (new version; open approval none). `submit_content` extended to accept `changes_requested`.
- App server functions (authenticated middleware) wrap these and trigger rechecking; no direct table writes.

Concurrency guarantees: stale `expected_version` rejected; one open approval (unique index + lock); decisions on superseded/decided approvals rejected; edits blocked while pending; approval blocked if a version was added.

## 8. UI
- Content detail becomes the two-column review screen: left original text/PDF text/image with underline + icon highlights for the latest version; right findings sorted by severity with category, confidence, quote, explanation, citation, Needs checking state, suggested rewrite and action buttons.
- Accept/Edit dialog with original vs proposed diff (additions/removals); Dismiss dialog requiring a reason. Version selector keeps history read-only.
- Submit-for-approval dialog: shows computed route, blocking findings, and a Reviewer picker only when required.
- Review Queue page (Reviewer) listing assigned open items; Manager All Content gains status filter and an approval queue view.
- Decision panel (approve / request changes with comment), threaded comments, activity timeline (versions, actions, approvals, comments).
- Accessible dialogs, keyboard navigation, screen-reader status text.

## 9. Tests
- Unit: transition table, gate calculation, routing rules, text application at offsets including emoji/Unicode, diff output, reason/comment validation.
- Security (live, temporary accounts, two workspaces, all four roles): Reviewer sees only assigned items; Manager cannot decide reviewer-routed items; Creator cannot self-approve, act outside `checked`, or bypass routing; forged/cross-workspace/non-reviewer reviewer IDs rejected; Admin denied; direct table writes refused; immutability of actions, decided approvals and comments; audit rows present.
- Concurrency: parallel duplicate decisions (one wins), decide vs new version, two parallel finding actions on one version, double submit-for-approval.
- Rechecking: new version gets fresh deterministic and AI reviews; old findings unchanged.
- Browser end-to-end: submit → findings → dismiss/accept/edit → recheck → route to Reviewer and Manager → request changes → revise → approve; comments.
- Full regression of Phases 1–5; skipped tests reported separately; Phase 1 deferred items unchanged.

## 10. Implementation sequence
1. Migration: enum values, three tables, grants, RLS, immutability triggers, functions; extend status hook so a recorded deterministic review moves `submitted` → `checked`.
2. Pure modules (transitions, routing, gate, text application) + unit tests.
3. Server functions with rechecking via existing Phase 4/5 code.
4. UI: review screen, dialogs, queue, decisions, comments, timeline.
5. Live security/concurrency tests, browser end-to-end, regression, progress report.

Dependencies: Phase 3 versioning, Phase 4 `record_review`, Phase 5 `record_ai_review`, Phase 1 roles/memberships.

## 11. Risks and remaining ambiguities (need owner decision)
1. Existing content already in `submitted` with a recorded review: backfill to `checked`? (Proposed: yes, in the migration.)
2. Spec "reject": proposed as "request changes" (returns to Creator). Should a permanent terminal rejection also exist?
3. Should AI review completion be required before submit-for-approval? (Proposed: no, to respect Phase 5 non-blocking; approvers see AI status.)
4. Image findings: no text to rewrite, so proposed Dismiss-only, or Creator uploads a replacement image via changes path.
5. Must a dismissed high/critical `cannot_verify` claim still go to a Reviewer? (Proposed: yes — dismissal never removes Reviewer routing.)
6. Should Managers be allowed to reassign or change the selected Reviewer? (Proposed: no in Phase 6.)
7. Risk: offset-based rewriting on PDF-extracted text; mitigated by verifying quote at offsets before applying.
8. Risk: AI rerun cost/latency (10–20 s) on every action version.

Out of scope: Insights, AI transparency page, guideline import, demo data. Phase 1 deferred items (one-hour session check, 3 profile tests) remain documented.
