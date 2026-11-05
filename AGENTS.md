<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Markwise specification reference
- Preserve `docs/Markwise_Master_Project_Specification.md` as the verbatim user-supplied specification and consult it before phase implementation, so requirements remain available across sessions.

## Foundation architecture
- Use TanStack Router and Start authenticated server functions, preserving the platform's supported full-stack runtime.
- Keep workspace membership and roles separate; mutations use authenticated database functions with workspace authorization and audit writes to prevent client privilege escalation.
- Public signup provisions only a creator workspace; first administrator promotion is an explicit owner-authorized operation outside public app endpoints.
- Store avatars privately under user-ID paths with owner-only storage policies; resolve temporary signed URLs for display.
- Defer the root outlet to ClientOnly only while protected routes are matched; this prevents redirect hydration races while preserving public SSR and the managed auth gate.
- Track password recovery in the shared auth event subscriber; the auth SDK may consume recovery URL fragments before the form renders.
- Clear private query caches on SDK sign-out or account replacement, not only sidebar logout, to prevent stale account data rendering.
- Resolve membership email against confirmed Auth identities and return the current Auth email for the owner's profile; the signup email copy is not authoritative after email changes.
