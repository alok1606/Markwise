# Markwise — Phase 1 audit

**Audit date:** November 5, 2026, 10:10–10:17 UTC.
**Overall status:** Implementation audited and confirmed defects addressed, but **Phase 1 is not declared COMPLETE**. Fresh email-signup confirmation, email inbox delivery, live testing with all four roles, and session-expiry/refresh remain unverified.

This report supersedes older outstanding Lovable-sign-in notes: that option was deliberately removed and is no longer an acceptance requirement. No Phase 2 features were added. No passwords, provider credentials, tokens, or database identifiers are included here.

**Evidence labels:** PASS means the named check actually passed at the stated level. Source/configuration checks are explicitly labelled and are not successful authentication tests. BLOCKED requires external interaction or authorized account fixtures. NOT TESTED means no execution evidence. Historical results are separately labelled and not counted as fresh tests.

## A. Authentication results

| Test | Expected result | Actual result | Status |
|---|---|---|---|
| Hosted email/password settings | Email auth and signup enabled; confirmation required; anonymous signup off | Hosted settings returned HTTP 200 with these values | PASS — configuration only |
| Hosted Google settings | Google enabled | Hosted settings returned Google enabled | PASS — configuration only |
| Email signup form regression | Submit email/name/password with same-origin verification return; no sign-in before confirmation | Mocked service regression passed | PASS — automated, not delivery/signup E2E |
| Fresh real email-only signup | Account created and email link successfully redeemed | No fresh mailbox-confirmed signup performed; earlier confirmation visits failed, and owner confirmation occurred through Google | BLOCKED — mailbox interaction |
| Email/password login | Valid password establishes session | Earlier owner activity at 09:56:04 recorded success; fresh valid-password login not repeated because no password was supplied | NOT TESTED — fresh success; historical success documented |
| Invalid email-login handling | Reject invalid credentials and display error | 10:05:52 live test received HTTP 400; form displayed error | PASS — earlier same-day post-interface test |
| Email credential submission | Send exact credentials and enter dashboard after success | Retained mocked form test passed | PASS — automated only |
| Google login initiation | Correct provider and public same-origin return | Both login/signup buttons passed intercepted broker-request checks at 10:05; current source retains the same Google-only handler | PASS — initiation only |
| Fresh Google OAuth completion | External provider returns a valid session | Earlier owner Google login/token exchange at 09:54:37 succeeded; no fresh external-provider interaction performed in this audit | BLOCKED — owner provider interaction |
| Authorized session restoration | Owner can open administrator screen | Newly minted owner-authorized session restored and People & permissions loaded | PASS — not OAuth/password login |
| Session persistence | Signed-in access survives reload | Administrator page loaded again after browser reload | PASS |
| Session expiry / token refresh | Expired access token refreshes or safely returns to sign-in | SDK persistence/refresh is enabled in source; expiry boundary and refresh failure were not exercised | NOT TESTED |
| Logout | Clear session and deny protected pages | UI logout followed by direct protected-page navigation returned to sign-in, twice | PASS |
| SDK sign-out cache cleanup | Clear private query data even outside sidebar logout | New regression failed before fix and passed afterward | PASS — automated |
| Account-switch cache cleanup | Replacement identity cannot render old cached account data | Added identity-change cleanup; dedicated multi-account live switch not performed | NOT TESTED — source change only |
| Protected routes | Signed-out access denied | Dashboard, users, profile, settings and help each redirected to sign-in | PASS |
| Reset without recovery link | Password cannot be changed | Direct reset page disables submission; retained event regression also passed | PASS |
| Recovery password update | Verified recovery can update password and sign out without current password | Mocked service regression passed; earlier owner reset-link redemption/update at 09:55 succeeded | PASS — automated; real success is historical |
| Link expiration/reuse | Expired/reused links rejected with safe error | Fresh expiration/reuse tests not performed | NOT TESTED |

## B. Real email delivery results

| Test | Expected result | Actual result | Status |
|---|---|---|---|
| Supported delivery infrastructure | Supported email sending exists | Cloud Auth uses default managed authentication-email sending; no custom sender domain/setup exists | PASS — infrastructure identification, not delivery |
| Verified Markwise sender identity | Sender uses verified owner-controlled domain | Email-domain check returned no configured domain and setup not started | BLOCKED — owner-controlled domain |
| Password-reset request | Service accepts authorized reset request | 10:05:54 request returned HTTP 200 and sending hook succeeded | PASS — request/hook, not inbox receipt |
| Actual password-reset delivery | Owner receives usable reset email | Earlier 09:55 recovery-link redemption demonstrates usable-link completion; no fresh inbox observation or delivery event in this audit | BLOCKED — fresh mailbox check |
| Signup-confirmation delivery | Owner receives confirmation email and redeems link | Earlier requests/hooks succeeded, but observed confirmation visits failed; fresh email-only completion missing | BLOCKED |
| Delivery logs | Identify sent/rejected/bounced outcome | No events for owner in visible window; tool reports 14-day retention | NOT TESTED — receipt is not established by empty logs |
| Markwise email templates | Confirmation/reset emails display Markwise branding | Default sender/templates in use; no custom Markwise templates or verified sender exist | BLOCKED — branded-email setup |
| Email request failure handling | Show failures to users | Existing forms catch service errors; live invalid-login handling verified; simulated delivery-provider failure not exercised | PASS — source handling; provider failure NOT TESTED |
| Credentials safety | No private email credentials in frontend | No custom SMTP credentials required/configured; default managed sending retained | PASS — source/configuration review |

**Exact missing configuration:** a real domain owned by the project owner, verified sender setup, and custom Markwise authentication templates. No Gmail password, SMTP password, external provider API key or webhook secret is required for supported managed setup. A personal Gmail address cannot be verified as the sender domain. Built-in auth emails can still use the default sender without custom setup; lack of a custom domain is not proof delivery is broken. No email system was disabled or replaced.

**Link destinations:** source builds verification return from the current origin and recovery return from current origin plus `/reset-password`. Hosted Site URL is the preview. Preview/editor and platform app addresses appear in the hosted allow-list. Raw localhost is absent; local test requests do not establish that an email returns to localhost. For independent local testing use `http://127.0.0.1:8080/**` in More → Users → Auth settings → Advanced → Redirect URLs. There is no published application or custom production domain to verify yet. Do not change Site URL solely to enable MCP OAuth; those unrelated warnings do not apply to Google sign-in.

## C. First administrator verification

| Test | Expected result | Actual result | Status |
|---|---|---|---|
| Designated owner account | Correct account exists and email is confirmed | Owner account found; confirmation timestamp 09:54:37 UTC | PASS — database readback |
| Administrator role / ownership | Owner has Admin in own workspace | Admin role and matching workspace creator read back | PASS |
| Bootstrap record | Single initial promotion | Exactly one `first_administrator_promoted` audit record; no public bootstrap endpoint exists | PASS — record/source review |
| Repeated bootstrap operation | Reject second initial promotion | No repeat privileged bootstrap operation executed; no reusable public endpoint to call | NOT TESTED |
| Last-admin demotion | Prevent removing last administrator | Direct authenticated function request rejected with last-administrator error | PASS |

## D. Role and permission verification

| Test | Expected result | Actual result | Status |
|---|---|---|---|
| Creator user-management permission | Denied | Dedicated unit test passed; live creator fixture unavailable | PASS — unit; live BLOCKED |
| Manager user-management permission | Denied | Dedicated unit test passed; live manager fixture unavailable | PASS — unit; live BLOCKED |
| Reviewer user-management permission | Denied | Dedicated unit test passed; live reviewer fixture unavailable | PASS — unit; live BLOCKED |
| Admin user-management permission | Allowed | Unit test and actual administrator page/readback passed | PASS |
| Public signup role | Always Creator, ignoring privileged metadata | Live trigger definition inserts literal Creator into separate role table | PASS — source/database definition; fresh signup BLOCKED |
| Direct privileged role write | Disallowed even for admin browser client | Authenticated direct update returned permission code 42501 | PASS |
| Server role assignment authorization | Only workspace admin can assign roles | Database function validates caller's workspace-admin role before changes | PASS — definition review |
| Live Creator/Manager/Reviewer self-promotion denial | Server rejects each non-admin | Controlled fixtures absent; eight retained creator/admin integration tests skipped | BLOCKED |
| Admin self-role changes | No direct privileged update; final admin protected | Direct write denied and final-admin demotion denied. Authorized admin function can otherwise manage roles; no universal ban on self-demotion when other admins exist is implemented | PASS — existing intended boundary; multi-admin behavior NOT TESTED |

Later-phase content/review actions are intentionally absent and were not claimed as tested role capabilities.

## E. Database schema verification

| Test | Expected result | Actual result | Status |
|---|---|---|---|
| Phase 1 tables/primary keys | All five tables exist with primary keys | profiles, workspaces, workspace_members, user_roles, audit_log inspected; primary keys present | PASS |
| Membership/role integrity | Unique workspace/user pair; role references membership | Composite unique constraints and foreign key confirmed | PASS |
| User association | Profiles link to authenticated users; membership links profiles | Foreign keys confirmed; no orphan profiles or owner profiles found | PASS |
| Required fields/timestamps | Required identity fields and creation timestamps | Column metadata inspected; required fields and `created_at` defaults present | PASS |
| Indexes | User/workspace access paths indexed | Primary/unique indexes plus membership-user, role-user and audit-workspace/time indexes confirmed | PASS |
| Duplicate/incomplete identity data | No orphan profiles or members lacking role | All three integrity counts returned zero | PASS |
| Update timestamps | Accurate last-modified timestamps if required | Tables have creation timestamps only; no update timestamps added without a specified requirement | NOT TESTED / not implemented |
| Empty Drizzle schema placeholder | Platform-managed SQL history remains usable | Blank schema is the platform's required placeholder; not a defect, no schema push attempted | PASS — convention review |

## F. RLS and workspace isolation results

| Test | Expected result | Actual result | Status |
|---|---|---|---|
| RLS enabled | All application tables protected | All five report RLS enabled | PASS — hosted configuration |
| Grants | Anonymous table access absent; authenticated writes narrow | Hosted ACLs show authenticated SELECT only; profile editable-column grants retained | PASS — configuration |
| Policy scopes | Owner profile, workspace membership, workspace admin scopes | Every public policy and avatar policy inspected | PASS — definition review |
| Own profile read | Authenticated owner can read profile | Direct live query returned one row | PASS |
| Foreign workspace read/rename | No rows; mutation denied | Unrelated UUID returned no rows and rename rejected | PASS — unrelated nonexistent workspace; two populated workspaces NOT TESTED |
| Profile email mutation | Browser cannot change identity email | Direct update returned 42501 | PASS |
| Audit forgery | Browser cannot insert audit records | Direct insert returned 42501 | PASS |
| Invalid profile name | Empty/whitespace/overlength rejected | Whitespace accepted before fix, restored immediately; same check rejected after fix; three live tests passed | PASS — fixed |
| Full anonymous/authenticated CRUD matrix | Unauthorized SELECT/INSERT/UPDATE/DELETE blocked for every table and role | Definitions/grants inspected, but exhaustive matrix not run | NOT TESTED |
| Concurrent last-admin demotion | Preserve at least one admin | Workspace row lock exists in function; concurrency not exercised | NOT TESTED |

No RLS policy was weakened. No roles or administrator permissions were changed during the audit.

## G. Admin dashboard verification

| Test | Expected result | Actual result | Status |
|---|---|---|---|
| Administrator member screen | Loads actual workspace members | People & permissions loads owner member and Admin role after reload | PASS |
| Admin directory scope | Workspace members only, not global unrelated account directory | Implementation deliberately uses workspace-scoped membership | PASS — intended isolation |
| Assign Creator/Reviewer/Manager and add member | Validated change persists | Earlier controlled-account report recorded success; not freshly repeated because only owner account exists | BLOCKED — authorized second account |
| Non-admin page access | Denial message and protected server operations | Source/unit coverage present; new live non-admin browser check unavailable | BLOCKED |
| Last-admin error | Server denial preserves Admin role | Direct authenticated denial passed; owner role unchanged | PASS |

## H. Profile and workspace verification

| Test | Expected result | Actual result | Status |
|---|---|---|---|
| Full-name edit/persistence | Save then reload reads changed name | UI updated name, reloaded, verified value, restored original | PASS |
| Avatar upload/display/persistence | Private upload renders after reload | 64×64 test PNG uploaded through UI, rendered after reload; original empty avatar restored and test object removed | PASS |
| Avatar bucket privacy/size | Private with maximum 2 MB | Hosted bucket is private with 2,097,152-byte limit | PASS — configuration |
| Avatar MIME allow-list | Restrict uploads to allowed image types | Bucket has no MIME allow-list; UI checks PNG/JPEG/WebP and storage policy checks extension. MIME/content spoofing not tested | NOT TESTED — hardening limitation |
| Workspace rename/persistence | Admin change survives reload | UI rename verified after reload; original name restored | PASS |
| Workspace creation on signup | Profile, workspace, membership, Creator role provisioned together | Existing owner relationships valid and signup trigger reviewed; fresh signup completion missing | PASS — record/source; fresh signup BLOCKED |
| Authoritative current email | Owner profile displays current Auth identity; membership resolves current confirmed email | Changed owner access response and database member lookup to Auth email; database definition readback and owner page passed | PASS — implementation/readback; email-change scenario NOT TESTED |

Test changes to name, workspace and avatar were restored. Legitimate audit records from those operations remain intentionally preserved.

## I. Frontend and build verification

| Test | Expected result | Actual result | Status |
|---|---|---|---|
| Public pages | Render without errors | Home, login, signup, forgot-password, reset-password and demo loaded | PASS |
| Protected redirects | No protected content for signed-out user | Five protected routes redirected to login without page errors | PASS |
| Mobile navigation | Menu opens, destination loads, logout works | Mobile profile navigation and logout exercised | PASS |
| Markwise branding | No Lovable sign-in UI | Shared form uses only Google/email; no Lovable sign-in button found on account pages | PASS |
| Form validation/loading/error states | Invalid data prevented; busy/error handling exists | Required fields/server schemas and form-state code reviewed; retained mocked service tests passed | PASS — source/automated; exhaustive live states NOT TESTED |
| Empty states/broken links | All expected navigation works | Main routes and mobile profile link exercised; full link crawler and all empty states not run | NOT TESTED — exhaustive coverage |
| Runtime/page-loading errors | None in exercised flows | Two audit browser runs each reported zero page errors | PASS |
| Build and TypeScript | No critical compilation/type errors | Latest platform diagnostics repeatedly say build OK, including 10:16:42 UTC | PASS — harness checks, no redundant manual build |
| Page metadata | Unique Markwise titles/descriptions and social tags | Content routes use app-specific `head()` and metadata helper; no unrelated changes | PASS — source review |
| Production behavior | Published app and links work | Application is not published; production not exercised | BLOCKED |

The supplied “Session not found” warnings follow the 10:05:57 live logout check; no fresh successful login failure was demonstrated by those warnings alone. The audit's browser navigation correctly returned to sign-in. Signing out a restored shared session can also sign out another preview using that session; fresh audit sessions were minted for subsequent checks.

## J. Bugs fixed

1. **SDK sign-out cache hygiene:** cleared private queries on sign-out/account replacement, not just sidebar logout. Regression failed before the fix and passed afterward. Existing route gate and bearer middleware retained.
2. **Direct profile-name validation bypass:** live browser database update accepted whitespace before fix. Tightened database trigger to reject changed blank/overlength names and normalize valid names. Same reproduction now rejects; three live regression tests passed.
3. **Stale profile-email identity resolution:** source-confirmed membership lookup used signup email copy even after possible Auth email changes. Lookup now uses the confirmed Auth account email; owner profile reads current verified Auth identity. Source/hosted definition/readback verified. Did not change owner's actual email to manufacture an E2E test; that scenario remains explicitly untested.

No other confirmed defect was silently presented as fixed. Recovery recognition after a page reload remains limited by memory-only recovery state; direct unverified visits stay blocked. Expiration/refresh, MIME spoofing and multi-account switching require dedicated checks.

## K. External configuration / interaction still required

1. **Owner-controlled sender domain** for verified Markwise sender identity and branded templates. Use the email-domain setup dialog; managed setup requires no external SMTP credentials. Afterwards customize authentication emails and verify actual mailbox receipt/link completion.
2. **Fresh email-only signup and confirmation** with a real mailbox. Check inbox/spam; redeem a newly issued confirmation link once. Earlier Google account confirmation is not a substitute.
3. **Fresh Google and valid-password login**, followed by logout; never send passwords in chat. Test through the Markwise interface.
4. **Fresh reset-mail receipt/redemption and expired/reused-link behavior**. A successfully accepted recovery request does not prove inbox delivery.
5. **Authorized Creator, Manager and Reviewer accounts plus a second workspace** for full role/RLS and admin assignment tests. Only the owner's Admin account currently exists; no fictitious accounts or privileged roles were created.
6. **Session refresh/expiry exercise** and multi-account switching; current SDK configuration is not proof of those flows.
7. **Publication and production domain** before production redirect/delivery tests. No publish was performed without owner authorization.

## L. Tests passed, failed and skipped

Final retained-test run with explicit owner audit session: **19 passed, 0 failed, 8 skipped** across six files.

| Suite / individual test | Expected | Actual | Status |
|---|---|---|---|
| Creator cannot manage users | false | false | PASS |
| Manager cannot manage users | false | false | PASS |
| Reviewer cannot manage users | false | false | PASS |
| Admin can manage users | true | true | PASS |
| Exactly four specified roles | creator/manager/reviewer/admin only | expected enum; owner rejected | PASS |
| Only admin has user-management navigation | no Users for other roles | matched | PASS |
| Profile schema excludes roles | name validated; role stripped | matched | PASS |
| Route matching | root path resolves correctly | matched | PASS |
| Recovery SDK event and cleanup | recognize event after fragment removal; clear on sign-out | matched | PASS |
| SDK sign-out cache cleanup | cancel and clear; no sign-out refetch | failed before fix; passed after | PASS — fixed |
| Google OAuth from login | google + public origin | matched mocked call | PASS |
| Google OAuth from signup | google + public origin | matched mocked call | PASS |
| Email credential submission | exact email/password + dashboard after success | matched mocked calls | PASS |
| Unconfirmed signup | correct confirmation return, no dashboard navigation | matched mocked call/session behavior | PASS |
| Recovery request | correct email and public reset return | matched mocked call | PASS |
| Recovery update/logout | new password only, then sign out | matched mocked calls | PASS |
| Live empty name update | reject; preserve original | rejected | PASS |
| Live whitespace name update | reject; preserve original | rejected | PASS |
| Live 101-character name update | reject; preserve original | rejected | PASS |
| Creator unrelated profile read | no rows | fixture unavailable | BLOCKED — skipped |
| Creator direct role update | permission denied | fixture unavailable | BLOCKED — skipped |
| Creator self-promotion function | admin authorization denial | fixture unavailable | BLOCKED — skipped |
| Last-admin demotion integration test | denial | fixture suite skipped; separate direct browser check passed | BLOCKED — skipped suite |
| Admin unrelated workspace rename integration test | denial | fixture suite skipped; separate nonexistent-workspace browser check passed | BLOCKED — skipped suite |
| Creator audit forgery | permission denied | fixture unavailable | BLOCKED — skipped |
| Admin unrelated populated workspace read | no rows | fixture unavailable | BLOCKED — skipped |
| Creator profile-email update | permission denied | fixture unavailable | BLOCKED — skipped |

The live profile tests require `MARKWISE_AUDIT_SESSION` pointing to a securely minted owner-authorized session; without it those three tests skip. Session contents never enter source control. All eight original database-security tests require explicit controlled fixtures and were not represented as passed.

## Acceptance decision

**Audit work is finished; Phase 1 acceptance remains pending.** Administrator access, actual profile/workspace/avatar operations, tested security denials and current build health pass. The unresolved external dependencies and missing live role/expiry coverage above prevent a blanket “all checks passed” claim. Review this report and complete the blocked authentication/role checks before approving Phase 1. Phase 2 remains untouched.

## Final acceptance recheck — November 5, 2026, 10:22–10:25 UTC

No working application features, schema, RLS, roles, provider settings or administrator privileges were changed in this recheck. Only this report and the task list were updated.

### Fresh results

| Check | Expected result | Actual result | Status |
|---|---|---|---|
| All retained tests with authorized owner session | Regressions pass | 19 passed, 0 failed, 8 skipped; includes three live database profile-validation tests | PASS for executed tests; skipped cases remain BLOCKED |
| Controlled four-role account availability | Admin, Manager, Reviewer, Creator accounts available | Database contains only the designated owner with Admin role and one workspace | BLOCKED — three additional authorized accounts needed |
| Admin status and verification | Owner remains confirmed Admin | Confirmed email and Admin read back; latest sign-in timestamp 10:20:13 UTC | PASS — readback; timestamp alone does not identify login method |
| Administrator screen and browser reload | Valid restored session survives reload | People & permissions loaded and persisted after reload in two browser runs | PASS — restored session, not fresh password/OAuth login |
| Explicit token refresh | Auth SDK obtains new valid session | Both attempts returned HTTP 400, `validation_failed`, “Refresh token is not valid”; no refreshed session returned | BLOCKED for real-session acceptance; attempted refresh FAILED for minted fixture |
| Access after failed refresh | No false assertion of token renewal | Existing protected page still loaded; this proves only existing access remained valid, not successful refresh | PASS — existing access only |
| Invalid/expired recovery callback | No password update allowed | Simulated `otp_expired` callback on reset page left Update password disabled | PASS — simulated callback safety, not real-token elapsed expiry |
| Logout | Session ends and protected pages denied | UI sign-out followed by each of five protected routes redirected to login | PASS |
| Runtime errors in exercised screens | No page errors | Both browser runs recorded zero page errors | PASS |
| Managed delivery logs since 10:10 | Establish dispatch outcome if available | No events in visible window for owner; does not prove delivery or failure | BLOCKED — inbox/delivery evidence missing |
| Fresh signup/reset receipt and link redemption | Mail received and links complete | No mailbox access or new email-only account available; not claimed passed | BLOCKED — owner interaction |
| Two populated workspace RLS checks | Foreign reads/modifications/deletes denied | Only one real workspace exists; no second populated workspace was invented | BLOCKED |

**Refresh interpretation:** the authorized preview-session fixture was minted for inspection, not obtained through a normal email/password or Google login. Its refresh token was rejected. Do not infer that real user refresh is broken from this fixture error, and do not claim refresh passed because the old access token still worked. A normal signed-in session is required to reproduce the refresh check meaningfully. Natural expiry, automatic refresh and revoked-session handling remain NOT TESTED. No production behavior was changed to force this test through.

**Skipped integration tests (eight):** creator unrelated-profile read; creator direct-role write; creator self-promotion function; final-admin demotion fixture test; admin foreign-workspace rename fixture test; creator audit insert; admin foreign populated-workspace read; creator profile-email write. All remain skipped for lack of controlled credentials/accounts, not passed. The separate owner browser denials in the earlier audit do not replace the two-account suite.

### Exact owner steps to unblock acceptance

1. Sign in to Markwise with your normal email/password or Google account. Do not paste any password, email link or token into chat. Tell me which sign-in method you completed so I can recheck the resulting activity/session.
2. Create **three controlled accounts using real email addresses or aliases you own and can receive mail at**. For the fresh signup-confirmation test, use Markwise Create account, not Google, and redeem a newly received confirmation email once. Do not use invented email addresses. Record whether the email arrived in inbox or spam and whether confirmation completed.
3. If account provisioning through the owner interface is preferred for role tests, use **More → Users → Add user → Create new user** with three controlled addresses and passwords. These accounts are already confirmed, so this path does **not** replace the email-signup confirmation test.
4. As your existing Admin, open Markwise **Users**, add each confirmed account to your workspace, and assign **Creator**, **Manager** and **Reviewer** respectively. Keep your own Admin role unchanged. Each account's signup provisions its own Creator workspace; keep those separate workspaces to enable two-populated-workspace isolation checks. Tell me which controlled account corresponds to each role; do not send passwords.
5. Sign in as each controlled account through the preview when requested. I can verify that account's page/navigation/database access using its authorized session. Session minting for another account may show a permission card; approve only the controlled account being tested.
6. In a normal signed-in session, reload the browser and confirm your workspace remains accessible. Then let me verify an explicit refresh against that genuine session; natural expiration/automatic refresh requires a separate elapsed-expiry check. A reload by itself is not a refresh-token test.
7. From Markwise **Forgot password**, request a new reset email for a controlled mailbox. Check inbox and spam; open the newest link, set a new password, and sign in with it. Tell me the receipt and completion outcomes, without sharing the link/password. Reusing the consumed link should not allow another reset; actual elapsed expiration remains a separate test.

**Email configuration:** default managed authentication sending remains the supported delivery path. A verified custom sender domain is optional for default auth delivery and required only for Markwise-branded sender/templates. No custom sender domain is currently configured; no external SMTP credentials are required. Mailbox receipt is still unverified. Production redirects remain unverified because no application publication was authorized.

**Unresolved security verification:** full non-admin role tests, cross-workspace CRUD matrix, real refresh/expiry, account-switch behavior and avatar MIME/content spoofing remain unverified. The previous fixes remain in source and their executed regressions pass; this is not a claim that every security scenario passed.

**Decision:** Phase 1 remains **PENDING ACCEPTANCE**, not COMPLETE. Nineteen tests passed, eight skipped; the minted-fixture token-refresh attempt failed and needs a real login session. Account creation and mailbox steps above require owner participation. Phase 2 has not started; wait for owner approval.
## Final acceptance audit (2026-11-05 11:06 UTC)
- Automated: 28 passed, 0 failed, 11 skipped (8 live DB-authorization + 3 live profile-validation tests; skipped because no controlled test-account fixture file is configured).
- Stored roles: Admin (admin, shared workspace); Manager/Reviewer/Creator each hold their invited role in the shared workspace plus Creator in their own personal workspace. All four emails confirmed.
- Owner-reported live checks: Manager, Reviewer, Creator logins and role labels/navigation correct.
- Auth logs (7 days): no signup-confirmation, password-recovery, verify or logout events recorded; email delivery not evidenced in this window.
- Decision: PENDING. Blockers: non-admin /users denial and cross-workspace denial not exercised live as those accounts in this audit; real-login session refresh unverified; fresh signup-confirmation and reset-email receipt unverified; live DB tests skipped.

## User-performed live checks (reported by owner, 2026-11-05 11:09 UTC)
These are manual checks performed by the owner, not automated tests.
- Admin can access /users.
- Manager, Reviewer and Creator are blocked from /users and see "Administrator access required".
- Manager, Reviewer and Creator log in successfully and see their correct role-specific dashboards and navigation.
- Manager workspace selection and role display verified after the workspace-selection fix.
- Reviewer workspace and role display verified.
- Creator workspace and role display verified.

Status: Phase 1 remains PENDING. Remaining blockers: normal-login session refresh; fresh signup-confirmation email delivery and redemption; fresh password-reset email delivery and completion. Live database tests remain skipped without a controlled fixture file. Phase 2 not started.

## User-performed live checks and final recheck (2026-11-05 11:18 UTC)
User-performed live checks (manual, not automated):
- Fresh signup confirmation email arrived and verification succeeded (Krittibus Singh test account).
- Password-reset email arrived and reset completed successfully (same account).
- Role-specific login and dashboards verified for Admin, Manager, Reviewer, Creator.
- All non-Admin roles denied /users.

Corroborating auth logs (skrittibus@gmail.com): signup 11:13:32 (confirmation requested) -> verify 11:13:41 (signed up); recovery requested 11:14:12 (email hook succeeded) -> verify 11:14:28 -> password updated 11:15:47 -> logout 11:15:47 -> password login with new password 11:16:21.

One-hour session persistence: NOT VERIFIED. No refresh-token grant appears in auth logs in the last 24 hours; earliest current session began 10:36 UTC, so no session has yet reached one hour.

Regression tests: 28 passed, 0 failed, 11 skipped (live DB tests; no controlled fixture file).

Decision: PENDING — sole blocker is normal-login session refresh after about one hour. Phase 2 not started.
