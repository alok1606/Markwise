# Markwise Phase 1 completion report

## Implemented
- Responsive landing page, email signup/login, Google and Lovable sign-in options, forgot-password and public recovery screens.
- Confirmation-required signup; no automatic administrator assignment.
- Profiles with editable name and private avatar upload; workspace identity settings.
- Workspace-isolated profiles, workspaces, memberships, separate role records and audit records.
- Creator, Manager, Reviewer and Admin roles; server-authorized role assignment and membership management.
- Protected signed-in workspace screens, role-specific sidebar, administrator member management.
- Last-administrator demotion protection, restrictive table grants, RLS on all five application tables, owner-only avatar policies.
- Account creation, profile changes, workspace changes and role assignments generate audit records.

## Actual verification
Final automated run: **16 passed, 0 failed** across access, route matching and live authenticated database-request tests.

Live security tests verified: unrelated profile/workspace reads return no rows; creator role writes and self-promotion are denied; profile-email writes are denied; ordinary audit inserts are denied; final administrator demotion and cross-workspace settings changes are rejected.

Browser checks used four temporary, administrator-provisioned accounts: each role signed in, loaded its workspace, saved a profile and read it back after reload, signed out, and was denied protected access afterward. Non-admin users saw an administrator-access denial at `/users`. Administrator membership addition and role changes were exercised and read back. Private avatar upload/display, workspace rename/readback, and mobile navigation passed. Landing and account screens rendered; mobile landing had no horizontal overflow.

Database inspection confirmed RLS on profiles, workspaces, workspace_members, user_roles and audit_log. A test exposed pre-existing broad default grants; the second migration explicitly revoked them and retained only permitted access. The same live tests then passed.

Latest platform build diagnostic: **build OK**. No production deployment was made or verified.

## Remaining verification and issues
- First real administrator promotion awaits the requesting user's confirmed signup and account identification. No public administrator bootstrap exists.
- Public signup with a reserved `example.com` test address was correctly rejected. End-to-end signup email delivery/confirmation needs a real mailbox; it has not been verified.
- Password reset request and recovery forms are implemented, but email delivery and complete recovery-link password update remain unverified. A controlled recovery-link generation attempt was blocked by the environment's session-consent policy and was not bypassed.
- Google/Lovable providers were enabled, but interactive external OAuth completion remains unverified.
- Signed-out hard navigation to protected pages redirects correctly, but local preview emits recoverable TanStack `MatchView` hydration warnings during that redirect. No blank final screen was observed; the warning is unresolved.
- Concurrent last-administrator races were not tested; the role-assignment function locks the workspace row.
- Phase 2 features are intentionally absent. Future sidebar entries are visibly unavailable rather than fake working pages. Demo access requires provisioned accounts; brand seed data was not added.

## Main screens
- `/`: landing
- `/auth`, `/signup`: account entry
- `/forgot-password`, `/reset-password`: password recovery
- `/dashboard`: workspace overview
- `/profile`: name and avatar
- `/users`: administrator member management, denied for other roles
- `/settings`: workspace identity
- `/help`: current account/workspace documentation

## Manual testing
1. Create an account with a real email, confirm the email, then sign in.
2. Save a name and avatar in Profile; reload and confirm persistence.
3. Sign out and open `/dashboard` directly; expect the sign-in screen.
4. Identify the confirmed owner account for secure first-admin promotion.
5. As admin, add another confirmed account by email, assign each role and verify corresponding sidebar/access.
6. Attempt to demote the last administrator; expect rejection.
7. Request password reset from a real mailbox, open the recovery link and set a new password.

## Running retained tests
Run `bunx vitest run` for local tests. Live database tests are opt-in: set `MARKWISE_TEST_ACCOUNTS` to a secure temporary JSON file containing explicitly provisioned test accounts (role, id, email, password), with backend URL and publishable key available to the test runner. Never commit that fixture. The live tests do not require privileged credentials.

## Architecture
The platform's existing TanStack Router/Start setup was preserved rather than introducing React Router or unsupported Edge Functions. App operations use authenticated server functions and workspace-authorized database functions; privileged account provisioning is not exposed as a public endpoint. No AI, content submission, knowledge-base logic or approval workflow was implemented.