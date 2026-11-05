# Judge Demo Access — CodeNexus India 2026 (PLAN ONLY, awaiting approval)

Goal: let hackathon judges explore the full authenticated Markwise workflow at
https://markwise-product-studio.lovable.app using dedicated demo accounts in an
isolated demo workspace. **No application code, schema, RLS or permission changes
are needed** — this is account and data provisioning only, using the existing
role system exactly as built and tested in Phases 1–6.

## 1. Proposed demo workspace structure

One new workspace, e.g. **"Judge Demo — Nimbus Onboard"**, created fresh.
It is a normal workspace: same tables, same RLS, same server-side validation as
the team's workspace. Nothing about it is special in code — isolation comes from
the existing, already-tested workspace RLS.

Four demo accounts, each with exactly one role in this workspace only:

| Account (proposed) | Role in demo workspace | What the judge can do |
|---|---|---|
| salok3191+judge.creator@gmail.com | creator | Create/edit/submit content, run checks + AI review, act on findings, send for approval — own content only |
| salok3191+judge.manager@gmail.com | manager | Read submitted content, decide manager-route approvals, comment |
| salok3191+judge.reviewer@gmail.com | reviewer | Decide assigned reviewer-route approvals, comment |
| salok3191+judge.admin@gmail.com | admin | Knowledge base (rules/facts/glossary/palette/fonts/brand), Users page, AI-call log. By design **cannot** see content — this is a feature to show judges |

Plus-addressing on the owner's existing Gmail keeps all mail in one inbox and
matches the existing team-account pattern. Alternative: any four addresses the
owner prefers.

Side effect to note: the signup trigger auto-creates an empty personal
"My workspace" for each new account. These are harmless, empty and visible only
to that account; they can be left or cleaned up afterwards.

## 2. Account creation and role assignment method

1. Create the four auth users server-side (Lovable Cloud admin user creation,
   the same mechanism used for test fixtures): confirmed email, strong random
   passwords (generated, never committed).
2. Create the demo workspace (created_by the judge-admin account).
3. Assign roles with the existing admin-only `manage_workspace_member` function
   — the same audited path the app itself uses. No direct table writes, no new
   grants, no RLS changes.

## 3. Demo data required

**Knowledge base** — reuse the existing `load_demo_knowledge` function as-is
(Nimbus Onboard fictional brand): brand profile, 8 rules (LEGAL-01/03, CLAIM-01/02,
TERM-01, TONE-01, VISUAL-01, A11Y-01), 5 approved facts (incl. FACT-014 "up to 40%"),
4 glossary entries, 5 palette colours, 1 brand font. All rows are marked `is_demo`.

**Sample content in every workflow stage** — produced by driving the *real*
pipeline with the demo accounts (scripted, same as the Task 3 Nimbus E2E), so all
findings, reviews, approvals and audit events are genuine system output, not
hand-inserted rows:

1. One **draft** (text) — judges can edit and submit it themselves.
2. One **checked** item with open findings ("60%, guaranteed!" sentence →
   deterministic LEGAL-03 critical + CLAIM cannot_verify; AI contradicted vs
   FACT-014 with suggestion).
3. One **pending_reviewer** item routed with claim/legal reasons.
4. One **approved** item (reviewer decision with comment).
5. One **changes_requested** item.
6. One **rejected** item (terminal state).
7. Optionally one image item showing visual checks (alt text, contrast, palette).

AI review runs needed: ~4–6 calls (well under the agreed 300-call cap).

**Judge guide** — a short `docs/Judge_Demo_Guide.md` (kept out of the app, shared
with the submission): the four logins, a suggested 15-minute path through the
workflow, and notes on what each role can and cannot see.

## 4. Security risks and mitigations

| Risk | Mitigation |
|---|---|
| Demo users reaching the team's real workspace | Impossible without a role row there; RLS isolation proven by 59+ live cross-workspace tests. Verified again after setup with a signed-in cross-workspace access check. |
| Credential leakage | Passwords are generated, stored only in the owner's password manager and the hackathon submission's private credential field. Never in the repo, README, or public pages. |
| Judges modifying demo state for other judges | Expected and acceptable; reset procedure below restores a clean state in minutes. |
| AI credit consumption by judges | AI review only runs on demand; demo volume is trivially small. No changes needed. |
| Judge admin account altering KB demo data | That is intended demo behaviour (Admin KB features are part of what judges should see); `load_demo_knowledge` is idempotent (`ON CONFLICT DO NOTHING`) for re-seeding. |
| Password-reset emails | Plus-addresses deliver to the owner's inbox; judges use the provided passwords directly. |
| Access to project settings, secrets, editor | Judges get app accounts only. No Lovable editor access, no backend access, no secrets are shared or exposed. |

## 5. Credential sharing recommendation

Put the four email/password pairs in the CodeNexus submission form's private
credential/notes field (or the organizer's private channel), alongside the judge
guide. After judging: rotate the passwords or delete the four accounts entirely.

## 6. Reset after judging (without weakening immutability)

- Content/reviews/findings/approvals/comments/AI-call log: the existing
  service-role-only `purge_workspace_content(workspace_id)` function deletes all
  content data for the demo workspace. It works *through* the audited
  `markwise.content_purge` session flag inside one locked function — immutability
  triggers stay enabled for everyone else and are never altered. Verified: the
  function is granted to `service_role` only, so no app user (including the demo
  admin) can call it.
- KB demo data: `remove_demo_knowledge` + `load_demo_knowledge` (admin-gated).
- Re-run the seeding script to restore the six sample items.
- Full teardown option: delete the four auth users; their personal workspaces and
  the demo workspace go with them.

## 7. Existing functionality reused (nothing new built)

- `load_demo_knowledge` / `remove_demo_knowledge` (Phase 2)
- `manage_workspace_member` role assignment (Phase 1)
- Entire content/check/AI/approval pipeline (Phases 3–6)
- `purge_workspace_content` reset function
- Task 3 Nimbus E2E script as the seeding workflow template
- Existing RLS + cross-workspace live test suites for verification

## 8. Estimated effort

~4–6 hours total: account + workspace setup (0.5h), demo KB load (0.25h),
scripted workflow seeding incl. AI runs (2h), cross-workspace security
verification (0.5h), judge guide (0.5h), buffer.

## 9. Verification before handover

- Sign in as each of the four accounts on the **production** URL; confirm role-
  correct pages.
- Confirm each judge account sees only the demo workspace (plus its own empty
  personal workspace) and is denied the team workspace (page + database check).
- Confirm the six sample items are in their intended states with genuine
  findings/approvals.
- Report passed/failed/skipped separately, as usual.

## Explicitly out of scope

No code changes, no schema changes, no RLS/permission changes, no new UI, no
Vercel work, no Phase 7 work. Nothing is implemented until you approve this plan.
