# Phase 3 — Content Creation and Submission (plan, not started)

Source: saved Master Specification (Part 4 roles, data model `contents` / `content_versions`, Part 7E "Content submission", Part 9 tests). No separate "Round 2 build plan" file is saved in the project; if it differs from this plan, upload it and the plan will be adjusted before approval.

Preserved unchanged: sign-in, roles, workspace selection, the Knowledge Base, all existing security rules and workspace separation.

## 1. Features
- **New Content** (Creator): form with Title, Type, Channel, Audience, Goal, then type-specific input; Save draft.
- **My Content** (Creator): list of own items with status, type, last updated; open, edit draft, view version history, delete own draft.
- **Content detail**: current version, metadata, version history (read-only past versions), file preview/download for permitted users.
- **Submit**: Creator marks a draft "Submitted" (locks it from editing). In Phase 3 submission only records intent; routing to a manager or reviewer happens in the approval phase.
- **All Content** (Manager): read-only list of all submitted content in the workspace, with filters (type, status, creator).
- Reviewer "Review Queue" and Insights stay locked placeholders.

## 2. Content types and metadata
| Type | Input | Rules |
|---|---|---|
| Text | Plain-text editor with live character count | Up to 50,000 characters |
| Image | Private upload (PNG, JPG, WebP, up to 10 MB) | Alt-text field required but may be empty (later check flags it); optional text and background colour (HEX) |
| PDF | Private upload (up to 20 MB) | Text extracted in the browser, shown to the creator, saved only after the creator confirms |

Metadata: title (required, max 160), type, channel (e.g. Web, Email, Social, Print, Other), audience (max 300), goal (max 500).

## 3. Lifecycle
```text
draft --(creator edits: new version)--> draft
draft --(creator submits)--> submitted   [locked]
submitted --(later phases)--> in_review / approved / rejected / changes_requested
```
- Every save of text, alt text, colours or file creates a new immutable row in content versions; earlier versions are never edited or deleted.
- Only drafts can be edited or deleted, and only by their owner.
- Statuses for later phases are defined now but cannot be set in Phase 3.

## 4. Permissions
| Action | Creator | Manager | Reviewer | Admin |
|---|---|---|---|---|
| Create / edit own drafts | Yes | No | No | No |
| View own content and history | Yes | — | — | — |
| Submit own content | Yes | No | No | No |
| View all submitted workspace content | No | Yes (read-only) | No (assigned items arrive in approval phase) | No* |
| View other users' drafts | No | No | No | No |
| Approve / reject | No (approval phase) | | | |

*Spec gives Admin no content rights; Admin keeps Knowledge Base and Users only. If you want Admins to see content, say so before approval.

People with several roles across workspaces get rights per workspace only.

## 5. Files and storage
- New private bucket for content files, paths `<workspace_id>/<content_id>/<uuid>.<ext>`.
- Upload rules: owner Creator in that workspace may upload into own content folder; read allowed to owner and to Managers once submitted; no public links; downloads via short-lived signed links from the server.
- Server registers a file only after checking the path and the stored file's real size and type (same pattern as the Knowledge Base). Files belonging to past versions are kept.

## 6. Pages and navigation
- `/content` My Content (Creator), `/content/new` New Content (Creator), `/content/$id` detail and history, `/content/all` All Content (Manager).
- Sidebar links unlock per role; locked pages show "Access required" like the Knowledge Base.
- Calm enterprise styling consistent with existing pages; empty states, mobile layout.

## 7. Server authorization and database security
- Server functions (all authenticated): list own content, list workspace content (Manager), get content, save draft, submit, delete draft, register file, get file link, get history. Each checks membership and role first.
- Database: `contents` and `content_versions` protected by row rules: owner Creator full access to own drafts; Manager read on non-draft rows in their workspace; nobody else. Versions are insert-only (no update/delete for anyone).
- Database triggers: create a version on every content change, block edits once submitted, block changing workspace or owner, block status jumps not allowed in Phase 3, write audit log entries (created, saved, submitted, deleted, file uploaded).

## 8. Testing and acceptance
Automated:
- Unit: form validation per type, character limits, HEX colours, file type/size, PDF-text confirmation rule, status-transition rules.
- Live (temporary accounts across two workspaces, cleaned up afterwards, same method as Phase 2): Creator CRUD on own drafts; cannot read/edit others' drafts; cannot edit after submit; versions immutable; Manager reads submitted only, cannot write; Reviewer and Admin denied; cross-workspace read/update/delete/download denied by ID; server functions give the same results as the database rules.
- Browser: create each type, save, edit (version 2), submit, history, Manager view, mobile, no console errors.

Acceptance: all above pass; existing 45 tests and the Phase 2 security suite still pass; Knowledge Base unchanged; progress report written.

## 9. Dependencies on later phases (not built now)
- Automatic checks (banned terms, terminology, claims, contrast, alt text) — Phase 4: will read the exact content version; the colour and alt-text fields are captured now for it.
- AI review and findings, accepting suggestions — later phase; will create new content versions using the versioning added now.
- Routing to Manager/named Reviewer, approve/reject, comments, Review Queue, Insights — approval phase.

## 10. Deferred items kept on record
- Phase 1 one-hour session persistence: PENDING / DEFERRED.
- 11 skipped Phase 1 live tests: still need the private test-account file.

## Technical details
- Tables: `contents` (id, workspace_id, owner_id, title, type enum text|image|pdf, channel, audience, goal, body_text, file_path, alt_text, text_color, background_color, status enum, version, submitted_at, timestamps) and `content_versions` (id, content_id, workspace_id, version_number, body_text, file_path, alt_text, colours, changed_by, change_summary, created_at; unique content_id+version_number). GRANTs, RLS, indexes on workspace/owner/status.
- PDF extraction with `pdfjs-dist` loaded only in the browser after the page loads.
- New `src/lib/content.ts` (schemas, pure transition rules) and `src/lib/content.functions.ts`; new rules recorded in AGENTS.md.
