# Round 2 Task 5 – Live connectivity check

- Date/time: 5 Nov 2026, 16:12–16:25 UTC (21:42–21:55 IST)
- URL tested: the Lovable preview build (http://localhost:8080 in the build sandbox, same code and same Lovable Cloud backend as the preview URL). **The app is not published** – there is no production URL.
- Accounts: four existing accounts in one shared workspace (Admin, Manager, Reviewer, Creator). No accounts created, no roles changed, no data written, no AI calls.
- Screenshots: `docs/evidence/live-check/`

## Results
| Check | Result |
|---|---|
| Production deployment | NOT PUBLISHED (not tested) |
| Landing page, signed out | PASSED |
| Demo page, signed out | PASSED |
| Sign-in page | PASSED |
| Sign-in reaches backend / workspace loads (all 4 roles) | PASSED |
| Server functions and database respond | PASSED |
| Browser console / failed requests | PASSED (0 errors) |
| Creator: dashboard, My content, New content | PASSED |
| Manager: dashboard, All content | PASSED |
| Reviewer: Review queue | PASSED |
| Admin: Knowledge base, Users | PASSED |
| Signed out: dashboard, content, knowledge, users, review redirect to sign-in | PASSED |
| Non-Admins blocked from Knowledge base and Users (page and database) | PASSED |
| Each user reads only their own workspaces' role rows | PASSED |
| Admin blocked from content and review queue (by design) | PASSED |
| Workspace isolation with real content | NOT TESTED today – database holds no content, and creating data was not allowed. Covered by Phase 2–6 live tests. |
| Reviewer assignment limits | NOT TESTED today (no content). Last verified in the Nimbus demo (5 Nov). |
| Vercel | NOT VERIFIED |
