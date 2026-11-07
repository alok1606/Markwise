# Admin Reviews — read-only, activated (not published)

Date: 7 November 2026. Database change applied on owner instruction; nothing published.

## Root cause
- Admin navigation omitted Reviews.
- `/review` accepted only Reviewers; its query returned only personally assigned approvals.
- Content detail and server content-role checks excluded Admins.
- Live `contents_read` excludes Admins. Reviews, findings, versions, approvals, actions and comments use `can_read_content`, which also excludes Admins.
- Critically, `add_comment` uses `can_read_content` to authorize writes. Expanding that helper would accidentally let Admins comment.

## Change
The existing `/review` route includes an Admin-only read-only list, content/creator/reviewer search and status filters. It uses existing reviews, content and approvals, not another review system. Detail links reuse `/content/$id`: deterministic checks, AI findings and citations, approval history, versions and activity. Names use existing profile RLS; no profile policies were widened. Only items with at least one review are included; never-checked drafts and deleted items remain inaccessible.

Admin queries use the authenticated caller, never a service-role client. Review, content, approval and detail record queries explicitly scope the selected workspace. Reviewer queue semantics and Manager/Creator permissions are preserved. Admins receive no edit, submit, run-check, AI-run, finding-action, decision or comment controls.

## Database change (applied)
Reviewed source: `docs/pending-migrations/0019_admin_review_read_only.sql`. Applied as `drizzle/migrations/0018_admin_review_read_only.sql` with identical statements; only `BEGIN`/`COMMIT` were removed because the migration runner supplies the transaction.

It adds `can_inspect_content_review`, requiring current membership, Admin role in the content workspace, a non-deleted content record and a matching workspace review. Seven additive SELECT-only policies cover content and its review/history records. File-download authorization additionally accepts this predicate while retaining path/workspace validation. No tables, existing policies, table grants, upload rules, comment authorization or workflow functions are changed. `can_read_content` is unchanged, protecting comment restrictions.

Accepted as written by the owner: an Admin can read every version of a reviewed item, including a Creator's current unsubmitted edits after changes are requested.

Rollback: drop the seven `*_admin_review_read` policies, restore the previous `can_read_content_file` body (without the `OR can_inspect_content_review(...)` branch), then drop `can_inspect_content_review`.

## Verification after applying
- Seven new SELECT policies confirmed live.
- Browser, signed in as the Judge Demo Admin: `/review` lists all **9** reviewed items in "Judge Demo — AKS Company" (the 10th item has never been checked and stays hidden). An item detail shows findings, citations, approval history, versions and comments with no edit, decision or comment controls; zero page errors.
- Live four-role suite (`src/test/admin-reviews-roles-live.test.ts`, Judge Demo accounts): **12 passed**. Admin sees exactly the reviewed items; can read findings, versions, approvals and files; is refused for comments, approve/reject/request-changes, submit, create, direct inserts, updates and deletes. Creator still sees only own items; Manager only non-draft; Reviewer only assigned. All four roles read nothing from another workspace; signed-out visitors read nothing.
- Live Admin suite (`src/test/admin-reviews-security-live.test.ts`): **8 passed**.
- Post-test database check: no Admin comments, decisions, audit events or edited titles were created.
- Full suite: **146 passed, 0 failed, 163 skipped** (skipped suites need the multi-workspace private fixture and service key). Two legacy live suites were updated so reviewed content is now expected to be Admin-readable; their write-denial checks are unchanged.

## Files changed for this request
- `src/components/app-shell.tsx`, `src/lib/access.ts`, `src/lib/content.ts`
- `src/lib/admin-reviews.ts` (new)
- `src/lib/approval.functions.ts`, `src/lib/content.functions.ts`, `src/lib/content-queries.ts`
- `src/routes/_authenticated/review.tsx`, `src/routes/_authenticated/content.$id.tsx`
- `src/test/admin-reviews.test.ts`, `src/test/admin-reviews-security-live.test.ts`, `src/test/admin-reviews-roles-live.test.ts` (new)
- `src/test/approval-security-live.test.ts`, `src/test/review-security-live.test.ts` (expectations updated)
- `drizzle/migrations/0018_admin_review_read_only.sql` (applied), `docs/pending-migrations/0019_admin_review_read_only.sql`
- This report, `AGENTS.md`, and `roadmap.md`.

## Not done
Not published. The legacy multi-workspace live suites remain skipped without their private fixture.
