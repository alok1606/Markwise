# Markwise: Round 2 polish plan (existing product only)

Planning only. Phase 7A–7D are not touched, and the three Round 3 commitments are unchanged.
**Note:** your message says "CodeTitan India 2026", but the saved official rules say "CodeNexus India 2026". Please confirm which name to use in the README and the public pages.

## Findings from inspection
- The dashboard still shows the Phase 1 line "Content, reviews and insights are not available yet."
- The /demo page says demo data and workflows are "not included in Phase 1".
- Reviewers see "Workspace member" because names are visible only to the person themselves and to Admins (by design). The fallback lives in `src/lib/content.functions.ts` (lines 44, 72).
- The full activity log is visible to Admins only. Reviewers, Managers and Creators can already read versions, approvals, finding actions and comments for content they're allowed to see.
- The AI call log is already visible to Admins only, but no screen shows it yet.
- The sidebar shows an "Insights" item for Manager and Admin, with no page behind it.
- The README is still the starter placeholder.

## Tasks

| # | Task | Files | Database | Need for Round 2 | Effort |
|---|---|---|---|---|---|
| 1 | Replace stale dashboard text with real role-based next steps and live counts (my drafts, awaiting my review, and so on) | `routes/_authenticated/dashboard.tsx` | none | Necessary | S |
| 1b | Hide the Insights sidebar item until a page exists, or point it to an honest "Not available yet" page (your choice) | `lib/access.ts`, `components/app-shell.tsx`, maybe new `routes/_authenticated/insights.tsx` | none | Necessary (avoids a dead link) | S |
| 2 | Show the Creator's **name only** (never email) to people already allowed to read that item | new database function returning only the full name when the caller can read the content; `lib/content.functions.ts`, `components/content/review-actions.tsx` | **1 additive read-only function**; profile rules unchanged | Necessary | S–M |
| 3 | Rewrite /demo with the FACT-014/LEGAL-03 sentence and steps; one recorded end-to-end run in a temporary workspace (Admin loads demo data → Creator submits "We cut onboarding time by 60%, guaranteed!" → findings → accept → Reviewer approves), then clean up | `routes/demo.tsx`, a new browser test script under `/tmp`, evidence saved in docs | none (uses the existing demo-data loader) | Necessary | M |
| 4 | README: what Markwise is, architecture (TanStack Start server functions, Lovable Cloud, no Edge Functions), local setup, environment variables (names only), tests (unit vs live, and why some are skipped), deployment (Lovable publish; Vercel stated as untested unless verified), tool disclosure | `README.md` | none | Necessary | S–M |
| 5 | Check the live connection: publish status, the public pages load, sign-in reaches the backend, and a server action answers. Report only what was observed | none, or a docs note | none | Necessary | S |
| 6 | **Activity tab** on content: one timeline merged from versions, approvals, finding actions and comments | new `components/content/activity-timeline.tsx`, `routes/_authenticated/content.$id.tsx`, a read function in `lib/content.functions.ts` | none (does **not** open the Admin-only activity log) | Recommended (listed in Round 2) | M |
| 7 | **Admin AI-call log** page: time, item, model, status, error type, short summary; workspace-scoped; Admin-only both on screen and on the server | new `routes/_authenticated/ai-calls.tsx`, `lib/access.ts` nav, a read function | none | Recommended | S–M |
| 8 | **Public "How Markwise uses AI" page**: provider and model taken from code constants, what is sent, quote and citation checks, "cannot verify", no auto-edits, humans decide, provider terms link; no invented claims | new `routes/ai.tsx`, links from landing and footer | none | Recommended | S |
| 9 | Assessment only (no build) of Insights and the import assistant, below | — | — | — | — |

Sizes: S = under 1 h, M = 1–3 h. Total for tasks 1–8 is about 8–12 h of work, including tests.

## Task 9: assessment
- **Insights dashboard:** about 4–6 h. Needs read-only summary functions limited to the workspace (Manager and Admin), empty states, and tests. All data already exists. **Recommendation:** build it in Round 3 (planned 7.0-extended). For Round 2, remove the dead sidebar link and disclose it as unfinished.
- **Guideline import assistant:** about 6–10 h. Needs an AI proposal call with quote checking, a review screen, saving only on Confirm, and logging. It has the highest risk of the remaining gaps. **Recommendation:** disclose it as unfinished for Round 2 and keep it in the Round 3 plan.

## Security
- No changes to existing rules, roles or workspace isolation.
- The only database addition (task 2) returns a single name, only when the caller can already read that content. No emails, no lists.
- The Activity tab uses only data each role can already read. The Admin-only activity log stays Admin-only.
- The AI-call log stays Admin-only; the new page reads it through the existing rule.
- The public AI page shows no workspace data.
- Demo data is loaded only in a temporary test workspace, and the existing "Demo data: fictional company" label is kept. Nothing fake goes into real workspaces.

## Testing
- Unit tests: activity merge and ordering; dashboard next-step selection by role.
- Live tests with temporary accounts across two workspaces:
  - The name function returns a name for allowed readers, and nothing for another Creator, an unassigned Reviewer or another workspace.
  - Activity data is denied across workspaces.
  - The AI-call log is denied to non-Admins and across workspaces.
- Browser runs: the dashboard for each role; Reviewer sees the Creator's name; the Activity tab; the AI-call log as Admin (and blocked as Manager); the public AI page signed out; the full FACT-014/LEGAL-03 demo run. The run uses real AI, so the results are reported as observed.
- Full regression afterwards, with passed / failed / skipped listed separately. Temporary data is cleaned up.

## Decisions needed
1. Event name: CodeTitan or CodeNexus?
2. Insights link for Round 2: hide it, or show an honest "Not available yet" page?
3. Approve the one read-only database function for showing Creator names.
4. Approve tasks 6–8 (recommended) along with 1–5 (necessary).
