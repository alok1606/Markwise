# Markwise — Vercel migration assessment (planning only, nothing implemented)

## 1. Verdict
The complete app cannot run on Vercel today while keeping Lovable Cloud, because one required credential is not obtainable: the backend admin (service-role) key. Lovable documentation confirms it is not exported for external hosts. Five server functions need it. Two other items (AI access, Google sign-in) have documented or plausible alternatives.

There is one supported route that keeps Lovable Cloud and avoids the admin key: **rewrite the five privileged server operations so they run inside the database as signed-in-user functions** (Option B below). That is a real architecture change to Phases 3–6 security code, not a configuration change.

## 2. Architecture

```text
TODAY (works)                              PROPOSED (Option B)
Browser                                     Browser
  |  (session in browser storage)             |
Lovable hosting                             Vercel (Nitro "vercel" preset)
  - pages + server functions                  - pages + server functions
  - admin key (auto)  --+                     - NO admin key
  - AI key (auto)       |                     - own Gemini API key (server-only)
        |               |                           |            |
        v               v                           v            v
  Lovable Cloud: auth, database (RLS),        Lovable Cloud (unchanged data, RLS kept)
  storage, privileged DB functions            + privileged steps moved into signed-in
                                                DB functions that check the caller
  Lovable AI Gateway -> Gemini                Google Gemini API (direct)
```

## 3. Server functions affected (33 total; 5 depend on hosting-only credentials)
| File | Function | Dependency | Why |
|---|---|---|---|
| content.functions.ts | runContentChecks | admin key | reads rules/glossary/palette (Admin-only tables) for a Creator; calls service-only `record_review` |
| content.functions.ts | runAiReview (via ai-review.server.ts) | admin key + AI key | reads KB, writes `ai_calls`, calls service-only AI recorder |
| content.functions.ts | registerContentFile | admin key | deletes rejected uploads; calls service-only `set_content_file` |
| approval.functions.ts | actOnFinding | admin key | calls service-only `act_on_finding` |
| approval.functions.ts | listWorkspaceReviewers | admin key | reads role rows and profile names other users cannot read |
| ai-gateway.server.ts | callGatewayModel | AI key | Lovable gateway URL + key |
| integrations/lovable | Google sign-in | Lovable sign-in broker | not documented for apps hosted outside Lovable |

The other 28 server functions use only the signed-in user's own session and the public key, and would run on Vercel unchanged once the build target is switched.

## 4. Credentials
| Variable | Public / server | Obtainable? |
|---|---|---|
| VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID | public | Yes (already in the repo's environment) |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY | server | Yes (same values) |
| SUPABASE_SERVICE_ROLE_KEY | server | **No — not exportable from Lovable Cloud** |
| LOVABLE_API_KEY | server | Not documented for external hosts; treat as **No** |
| GEMINI_API_KEY (Google AI Studio) | server | Yes — owner creates one; billed by Google |
| NITRO_PRESET=vercel | build | Yes |
| Google OAuth client ID/secret (own) | backend setting | Yes, if owner creates one in Google Cloud; managed broker outside Lovable not confirmed |

## 5. Options
- **A. Keep Lovable as the full app; Vercel hosts nothing or a pointer page.** No risk. Recommended for Round 2.
- **B. Full app on Vercel, Lovable Cloud kept (recommended if Vercel is required).** Replace the five admin-key uses with database functions callable by signed-in users that check role and workspace themselves (same checks the server does today), keep RLS unchanged, switch AI to the Gemini API, switch build preset.
- **C. Hybrid:** pages + 28 ordinary functions on Vercel, privileged 5 still served from Lovable hosting. Splits one app across two hosts; cross-site calls, two deploys per change. Not recommended.

## 6. Option B detail
1. **Build:** add a Vercel build setting (`NITRO_PRESET=vercel` or preset in vite config). Keep Cloudflare default for Lovable.
2. **Database (biggest change):**
   - Allow signed-in callers to run `record_review`, `set_content_file`, `act_on_finding` and the AI recorder, with each function verifying `auth.uid()` is the Creator/assigned party and the content is in the right state. Today the server passes the actor in; it would come from the session instead.
   - Add a narrow signed-in function that returns only the KB passages needed for a check of content the caller owns (keeps KB tables Admin-only).
   - Add a narrow function returning reviewer names for the caller's workspace (Admin/Creator only), instead of reading profiles with the admin key.
   - Move upload-rejection cleanup into a database function or leave rejected objects for a scheduled cleanup.
   - **Risk:** the AI recorder and check recorder currently trust the server to compute findings. If callable by users, a Creator could submit fabricated findings. Mitigation: findings must keep being computed on the server (Vercel) and the DB function must re-validate every citation (already does) — but it cannot prove the findings came from the server. This weakens the Phase 4/5 "findings are immutable server output" guarantee unless a server-held signing secret is added (Vercel secret checked by the DB via a stored hash). That is new design work.
3. **AI:** replace the gateway caller with the Gemini API (`generativelanguage.googleapis.com`), same model family (`gemini-3-flash-preview` if available on Google's API; otherwise nearest), same prompt and validator. Error mapping 402/429 to Google's quota errors.
4. **Auth:** add the Vercel domain to allowed redirect addresses (sign-up confirmation, `/reset-password`). Google sign-in: switch to own Google OAuth credentials with standard backend OAuth, or keep email/password only on Vercel.
5. **Roles, isolation, approvals:** unchanged in principle; every moved check must be re-tested with the existing live suites.

## 7. Safeguards and a constraint I must flag
- I cannot create or switch Git branches from here; the platform only commits to the current branch, which syncs to `main`. To keep `main` unchanged, the owner would create `vercel-migration` on GitHub and the work would need to happen outside this editor (or on a Lovable draft, if acceptable). This needs an owner decision.
- Database changes apply to the shared live backend immediately — there is no branch-only database. Option B's database functions would be added alongside existing ones (not replacing them) so the Lovable app keeps working, but they would exist in production data's backend.
- No admin or AI keys in the browser; RLS untouched; Phase 7 not started; no production deploy.

## 8. Effort, cost, risk
| Item | Effort |
|---|---|
| Build preset + Vercel project + env | 1–2 h |
| Gemini direct caller + tests | 3–4 h |
| Five database rewrites + server-proof signing | 10–16 h |
| Auth redirects / own Google OAuth | 2–3 h |
| Re-run all live security suites, browser E2E on Vercel | 4–6 h |
| **Total** | **~20–30 h** |

Cost: Vercel Hobby is free for non-commercial use (Pro for teams); Gemini API billed by Google per token (see Google pricing page); Lovable Cloud usage unchanged. Risks: weakening the "server-only findings" guarantee; two live sites on one database running different code; time taken from Round 3 commitments.

## 9. Testing and rollback
- Tests: unit tests for new DB-function inputs; existing live suites (knowledge, content, findings, approval, activity, AI-call) run against Vercel preview; new tests proving a Creator cannot record fabricated findings or act on others' content; Nimbus E2E on Vercel.
- Rollback: Lovable deployment untouched throughout; new DB functions are additive and can be dropped by a migration; remove Vercel project.

## 10. Recommendation
Option A for Round 2 and Round 3 (keeps all security guarantees, no time lost). Revisit Option B only after Round 3, and only if a supported external privileged credential becomes available or the server-proof signing design is approved.

## Decisions needed
1. Option A, B or C.
2. If B: where the branch work happens (GitHub branch outside this editor vs Lovable draft), given shared-database constraint.
3. If B: approve owner-provided Gemini API key and accept Google billing.
4. If B: approve the server-proof signing design for findings.
