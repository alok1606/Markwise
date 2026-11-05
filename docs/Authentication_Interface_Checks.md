# Markwise authentication interface checks

Date: November 5, 2026 (UTC).

## Changes
- Removed Lovable sign-in from login and signup, leaving a full-width Google sign-in button and existing email forms.
- Restricted the interface's social handler to Google; retained the existing managed Google OAuth connection.
- No provider settings, database, profiles, roles, RLS, administrator permissions, Cloud services or unrelated pages were changed.
- Email signup confirmation, password login and recovery implementation remain unchanged.

## Actual post-change results
- Login and signup show Markwise branding with no visible Lovable references; desktop and mobile checked.
- Google buttons on both pages send the correct Google OAuth broker request with the same-origin public return URL. Requests were intercepted for validation; external Google completion was not repeated.
- Live email/password endpoint rejects invalid credentials and the interface displays its error. Successful password sign-in was not repeated because no password was supplied.
- Live password-recovery request for the owner's account returned HTTP 200 and displayed the success state. A reset email was requested; mailbox delivery and link redemption were not repeated.
- Reset page blocks password updates without a verified recovery session.
- Restored the owner's existing signed-in session, loaded People & permissions, signed out through the interface, and confirmed protected-page access then redirects to sign-in.
- No browser page errors. Mobile signup has no horizontal overflow.
- 15 automated tests passed, including Google invocation from both screens, email credential submission, unconfirmed signup remaining signed out, confirmation redirect, recovery redirect, verified password update/sign-out, recovery-event tracking and permissions. Authentication service calls in the new form tests are mocked; these are regression tests, not proof of external-provider completion.

## Still requires owner interaction
- Fresh Google OAuth completion and successful email/password sign-in after this interface change.
- Recovery mailbox delivery/link redemption and fresh signup email-confirmation redemption. Earlier real Google/password/recovery evidence is recorded in the Phase 1 report, not represented as a fresh post-change test.