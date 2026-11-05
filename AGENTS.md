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
- Active workspace is chosen client-side by a pure selector (stored per-user choice if still a member, else invited workspace, deterministic order) and persisted in localStorage; selection is display-only and never affects roles or server authorization.
- Knowledge-base tables are Admin-only per workspace (RLS via has_role admin on every operation) because the Master Specification makes the knowledge base an Admin-only area; later phases must read it server-side rather than widening these policies silently. Signed-out users have no table privileges on them, signed-in users only CRUD (history tables SELECT-only), so grants never exceed what RLS can allow.
- Rule and fact edits/deletes snapshot the previous row into history tables via triggers, and fact approval stamps the approver in the database; editing an approved fact's wording returns it to pending so no unapproved text is ever presented as verified.
- Knowledge files upload to private buckets under <workspace_id>/<uuid>.<ext>; the server registers them only after checking the path and the stored object's real size/type, so browser claims are never trusted.
- Content tables are read-only through the Data API; every content write goes through SECURITY DEFINER functions that lock the row, assign the version and write audit events, so clients can never set versions, bypass the submitted lock, or race an edit past submission.
- Content files are registered only by the server after checking the stored file's magic bytes, via a service-role-only function; storage allows upload into one's own draft and no overwrite/delete, so every historical version's file remains available.
