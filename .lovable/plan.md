# Phase 6 — Review Actions and Approval Workflow (plan for approval)

Source: Master Specification Part 7.H (Review screen), 7.I (Approval workflow), Part 4 roles, Part 5 `approvals`/`comments`, Part 8 security, Part 9 tests 12–15. Phases 1–5 remain unchanged except additive links.

## 1. Features
- Two-column review screen: content on the left with highlighted findings (underline + icon, not colour alone) on the exact reviewed version; findings on the right sorted by severity with category, confidence, quote, explanation, cited source, "Needs checking" state and suggested rewrite.
- Finding actions (Creator, own draft or returned content): Accept suggestion, Edit suggestion, Dismiss with mandatory reason. Original vs proposed shown with additions/removals. Accept/Edit create a new immutable content version; the original is preserved. Each action records user, time, outcome and final text.
- Submit for approval: allowed only when no unresolved high/critical findings remain on the latest version.
- Routing: if claim, legal or cannot_verify findings exist, Creator must pick a named Reviewer from the same workspace; otherwise content goes to the Manager queue.
- Reviewer: "Review Queue" of assigned items only; inspect findings; approve or reject with mandatory comment.
- Manager: all permitted submitted content, status filter, approve clean content, reject with reason. Managers cannot approve items that require a Reviewer.
- Threaded comments with author and timestamp; activity history per content.
- Creators can never approve their own content.

## 2. Status lifecycle (enforced in the database)
```text
draft -> submitted(checked) -> pending_manager | pending_reviewer
pending_* -> approved | changes_requested
changes_requested -> (Creator edits, new version) -> submitted ...
```
Illegal transitions (skipping stages, approving unassigned items, re-approving) are rejected server-side.

## 3. Data
- `finding_actions`: finding, version, action (accepted/edited/dismissed), reason, final text, resulting version, actor, time. Immutable.
- `approvals`: content, version, route (manager/reviewer), reviewer_id, assigned_by, status, comment, decided_by, decided_at. Unique open approval per content.
- `comments`: content, parent (threading), user, message, created_at. Append-only.
- All writes through SECURITY DEFINER functions that lock the content row, validate role, workspace, assignment and transition, and write audit events. Tables read-only via the Data API.

## 4. Permissions
| Role | Access |
|---|---|
| Creator | Own content; act on findings; submit; comment on own items |
| Manager | Workspace submitted content; approve/reject manager-routed items; comment |
| Reviewer | Only assigned items (content, findings, comments); approve/reject with comment |
| Admin | No content access (unchanged); Knowledge Base unchanged |
Reviewer read access to assigned content/findings/files is added narrowly by assignment; no other policy widened.

## 5. UI
- Review screen on content detail; Review Queue page (Reviewer); approvals filter on All Content (Manager); reviewer picker in submit dialog; comment thread; activity timeline. Keyboard-accessible dialogs and status text for screen readers.

## 6. Testing and acceptance
- Unit: transition table, routing rules, diff/offset handling (Unicode), dismissal reason required.
- Live (temporary accounts, two workspaces): all four roles; Reviewer sees only assigned items; Manager cannot approve reviewer-routed items; Creator cannot self-approve or bypass assignment; cross-workspace reviewer selection rejected; immutability of actions/approvals/comments; audit entries; race between approval and edit.
- Browser end-to-end: submit -> findings -> accept/edit/dismiss -> route -> approve/reject -> comments.
- Full regression; Phases 1–5 tests must still pass. Skipped tests reported separately.

## 7. Out of scope
Insights dashboard, AI transparency page, guideline import assistant, demo-data expansion. Phase 1 deferred items stay documented.
