# Admin Reviews — staged, not activated

Date: 7 November 2026. No database changes applied; nothing published.

## Root cause
- Admin navigation omitted Reviews.
- `/review` accepted only Reviewers; its query returned only personally assigned approvals.
- Content detail and server content-role checks excluded Admins.
- Live `contents_read` excludes Admins. Reviews, findings, versions, approvals, actions and comments use `can_read_content`, which also excludes Admins.
- Critically, `add_comment` uses `can_read_content` to authorize writes. Expanding that helper would accidentally let Admins comment.

## Prepared change
The existing `/review` route now includes an Admin-only read-only list, content/creator/reviewer search and status filters. It uses existing reviews, content and approvals, not another review system. Detail links reuse `/content/$id`: deterministic checks, AI findings and citations, approval history, versions and activity. Admin version accordions expose saved evidence for older versions too. Names use existing profile RLS; no profile policies were widened. Reviewed content only is included; drafts without reviews and deleted items remain inaccessible.

Admin queries use the authenticated caller, never a service-role client. Review, content, approval and detail record queries explicitly scope the selected workspace. Reviewer queue semantics and Manager/Creator permissions are preserved. Admins receive no edit, submit, run-check, AI-run, finding-action, decision or comment controls.

## Migration requiring review
`docs/pending-migrations/0019_admin_review_read_only.sql` is a draft outside the active migration directory. It has NOT been applied.

It adds `can_inspect_content_review`, requiring current membership, Admin role in the content workspace, a non-deleted content record and a matching workspace review. Seven additive SELECT-only policies cover content and its review/history records. File-download authorization additionally accepts this narrow predicate while retaining path/workspace validation. No tables, existing policies, table grants, upload rules, comment authorization or workflow functions are changed. `can_read_content` remains byte-for-byte unchanged, protecting existing comment restrictions.

Existing authenticated table grants include writes on approvals/comments/actions, but RLS has SELECT policies only; the draft adds no write policies. Content/version/review/finding write grants remain absent.

## Verification
- Reproduced before edits: Admin `/review` denied and no Reviews link.
- After edits: signed-in Admin sees Reviews navigation and screen; search and status controls work. Desktop 1280×1800 and mobile 450×558 screenshots inspected; no horizontal overflow, zero page exceptions.
- Latest preview build: OK.
- Full suite: **142 passed, 0 failed, 151 skipped**. Includes 8 new unit tests for role boundaries, preserved role permissions, search/status and workspace query scoping. Fixture-dependent live suites are skipped without private fixtures.
- Separately ran the new live suite with the owner's authenticated Admin session: **7 passed, 1 failed, 0 skipped**. All seven cross-workspace reads returned no rows. The positive existing-review read failed (zero rows), as expected while the migration remains unapplied; the selected owner workspace also has no confirmed review fixture. This is NOT a passing end-to-end Admin-data test.
- Confirmed the new database function is absent. No data writes, AI calls or permission changes were performed.

## Files changed for this request
- `src/components/app-shell.tsx`
- `src/lib/access.ts`
- `src/lib/content.ts`
- `src/lib/admin-reviews.ts` (new)
- `src/lib/approval.functions.ts`
- `src/lib/content.functions.ts`
- `src/lib/content-queries.ts`
- `src/routes/_authenticated/review.tsx`
- `src/routes/_authenticated/content.$id.tsx`
- `src/test/admin-reviews.test.ts` (new)
- `src/test/admin-reviews-security-live.test.ts` (new)
- `docs/pending-migrations/0019_admin_review_read_only.sql` (new, unapplied)
- This report, `AGENTS.md`, and `roadmap.md`.

## Awaiting owner approval
Review and authorize the draft migration before activation. Then rerun against an Admin workspace with real reviews, verify populated detail/file/history end-to-end, and run four-role negative-write and cross-workspace acceptance with authorized fixtures. Legacy live suites that explicitly expect Admin denial must be revised for reviewed content at that stage. Do not claim Admin data access is complete until those checks pass. No Phase 7 work or publishing is authorized by this change.