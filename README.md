# Markwise

Markwise is a brand-compliance review tool built for **CodeNexus India 2026**. Teams write marketing content (text, images, PDFs), Markwise checks it against the workspace's own brand rules, approved facts, glossary and legal wording, and then routes it through a human approval workflow. Humans keep final control: Markwise never approves, edits or publishes content on its own, and it never invents metrics or citations.

**Problem it solves:** marketing copy often ships with unapproved claims ("60% faster, guaranteed!"), banned legal terms or off-brand tone. Checking this by hand is slow and inconsistent. Markwise flags these issues with a cited source for every finding, and records who approved what and when.

Markwise is a **team-designed and team-directed software engineering project** – see section 12 for full attribution.

---

## 1. Main features (implemented, Phases 1–6)

- **Accounts and workspaces** – email/password sign-up with email verification, password reset, Google sign-in, private profile photos, one workspace per new sign-up.
- **Knowledge base (Admin only)** – brand rules, approved facts (with approval and history), glossary, legal wording, tone guidance, reference files, and a one-click Nimbus Onboard demo knowledge set.
- **Content** – create text, image and PDF content; every save creates a new immutable version; server-assigned version numbers; stale-edit protection; submitted content is locked.
- **Automatic checks** – six deterministic checks (e.g. banned terms, avoided glossary terms, unverified numbers, image colours) run on the exact submitted version.
- **AI review** – a separate AI review whose output is validated before being shown (see section 6).
- **Review actions and approval** – accept suggestion, edit, or dismiss with a reason; send for approval; automatic routing to a Reviewer when risky findings remain; Manager/Reviewer decisions (approve, request changes, reject); comments; full history.
- **Review queue, role dashboards and a public `/demo` walkthrough page.**

## 2. User roles and permissions

| Role | Can do | Cannot do |
|---|---|---|
| **Admin** | Manage users/roles and the knowledge base | Open or decide on content (by design) |
| **Manager** | Read submitted content in the workspace, decide on items routed to Managers | Edit content; access knowledge base |
| **Reviewer** | Decide on items assigned to them in the review queue | Edit content; access knowledge base; see unassigned items |
| **Creator** | Create, edit, submit and act on findings for their own content | See other creators' content; access knowledge base; approve their own work |

All of this is enforced in the database and on the server, not only in the interface. Workspaces are fully isolated from each other.

## 3. Technology stack

- React 19, Vite 7, TypeScript
- TanStack Router and TanStack Start (server functions for all app-internal server logic)
- Tailwind CSS v4 and shadcn/ui
- Lovable Cloud: database (Postgres with row-level security), authentication, private file storage, server functions
- Lovable AI Gateway, model `google/gemini-3-flash-preview` (set in `src/lib/ai-gateway.server.ts`)
- Vitest + Testing Library for tests; Playwright for browser acceptance runs

> Note: the original specification mentioned React Router and Edge Functions. The implemented app uses TanStack Router/Start server functions instead.

## 4. Architecture and request flow

```text
Browser (React + TanStack Router)
   │  signed-in request with bearer token
   ▼
TanStack Start server functions  (*.functions.ts, auth middleware)
   │  RLS applies as the signed-in user
   ▼
Lovable Cloud database ── SECURITY DEFINER functions for every write
   │                       (lock row, assign version, write audit event)
   ├─ private storage (content files, knowledge files, avatars)
   └─ AI calls only from *.server.ts → Lovable AI Gateway
```

Typical flow: Creator saves a version → submits → server runs automatic checks on that exact version and records them atomically → AI review runs and is validated/recorded separately → Creator acts on findings → sends for approval → database function routes to Manager or Reviewer → decision recorded immutably.

## 5. Database and workspace isolation

- Membership and roles are stored separately from profiles; roles are never taken from user-editable data.
- Every table has row-level security scoped to the workspace and role. Signed-out visitors have no access to private tables.
- Content tables are read-only through the data API; writes go only through database functions that check authorization and write audit events.
- Versions, reviews, findings, approvals, finding actions and comments are immutable.
- Files are stored privately under workspace/user paths; the server checks real file type and size (magic bytes) before registering them; display uses temporary signed links.

## 6. AI review, citation validation and `cannot_verify`

- AI output is treated as untrusted. The server recomputes quote positions, re-checks every citation against the knowledge-base sources actually sent to the model, and downgrades any unproven claim to **`cannot_verify`**.
- AI findings are stored separately from automatic findings and can never change them. One AI review per version.
- A failed AI call does not undo a submission. Every AI call attempt is logged (content-free summary) in an Admin-readable log table.
- A `cannot_verify` finding means "Markwise could not prove this from your knowledge base" – it is never shown as verified.

## 7. Local development

Requirements: Node.js 20+ and npm (or Bun).

```sh
git clone <this-repository-url>
cd <repository-folder>
npm install
npm run dev
```

The app connects to its Lovable Cloud backend; the database structure is managed through Lovable.

## 8. Environment variables (names only)

Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
Server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (managed by Lovable Cloud, not user-accessible), `LOVABLE_API_KEY` (AI Gateway, managed)
Live tests only: `MARKWISE_CONTENT_FIXTURE` and similar fixture paths

Never commit real values.

## 9. Testing

```sh
npm test
```

- **Unit/component tests** (`src/test/*.test.ts(x)` without `-live`) – checks, AI validation, approval logic, access rules, routing, auth forms, workspace selection. Run everywhere.
- **Live security tests** (`*-live.test.ts`, `database-security.test.ts`) – create temporary accounts in two workspaces and test row-level security, storage and cross-workspace isolation against the real backend, then clean up.
- **Browser acceptance tests** – Playwright runs performed during development (e.g. PDF checking, the full Creator → Reviewer → Manager flow, the Nimbus demo). Evidence is in `docs/` (see `docs/Nimbus_Demo_E2E_Report.md`). These scripts are not part of `npm test`.

**Skipped tests, honestly:** the live tests are written with `describe.skipIf(...)` and are **skipped automatically** when the fixture file or backend keys are not present – which is the case on a normal clone, because the service key is not available outside the managed environment. A run that reports them as skipped has **not** tested security; they were run with fixtures during each phase's acceptance (results in the `docs/Phase_*` reports).

## 10. Deployment

- **Lovable publishing (supported):** use Publish in the Lovable editor. Frontend and server functions are deployed together with the Lovable Cloud backend.
- **Vercel:** **not verified.** The app relies on TanStack Start server functions targeting an edge worker runtime, so a frontend-only Vercel deployment would not run the server logic. No Vercel deployment has been tested.

## 11. Known limitations and unfinished features

- **Insights dashboard** – not built (menu link removed).
- **Guideline import assistant** – not built.
- **Reviewer sees "Workspace member"** instead of the creator's name – deliberate, to avoid widening profile privacy.
- **Knowledge-base wording appears in citations** shown to Creators, Managers and Reviewers on findings (see note below).
- Automatic check may still mark a number as "needs checking" even when the AI review confirms it from an approved fact (the two reviews are independent by design).
- AI results can vary between runs.
- Live security tests are skipped without fixtures (section 9).
- Vercel deployment not verified.

**Citation visibility note:** findings store the cited rule/fact passage with the finding so the Creator can see *why* something was flagged. As a result, the cited knowledge-base wording is visible to anyone who can read that content, even though the knowledge base pages themselves are Admin-only. Only the cited passage is shown, not the full knowledge base. This is under owner review.

## 12. Project attribution and AI/tool disclosure

Markwise is a team-designed and team-directed software engineering project. The team defined its architecture, requirements, data model, security policies and workflows, and directed, reviewed and validated implementation. Lovable-assisted development tools were used during implementation, while Lovable Cloud provides the managed production infrastructure and hosting. AI-powered brand reviews use Google's Gemini model through the Lovable AI Gateway.

In detail:

- **Team responsibilities** – product design, requirements, architecture, database and security design (including the row-level security model and the server-enforced approval workflow), workflow engineering, implementation direction, code review, testing and validation. Every phase was specified, reviewed and formally accepted by the team before the next began.
- **Development tooling** – Lovable was used as an AI-assisted development environment during implementation. The team did not manually write every line of code, and Lovable was not used only for hosting.
- **Infrastructure** – Lovable Cloud provides production hosting and the managed backend: authentication, the PostgreSQL database, private file storage and server functions.
- **AI integration** – the Lovable AI Gateway provides access to Google's Gemini model (`google/gemini-3-flash-preview`) for AI-powered reviews. All AI output is validated server-side before being shown (section 6).

## 13. Round 3 planned improvements (PLANNED – not implemented)

1. Accuracy harness – measured precision/recall of findings on a labelled test set.
2. DOCX and PPTX content support.
3. Impact scan – find already-approved content affected when a rule or fact changes.

Plus gap closure (Insights, import assistant) and hardening. See `docs/Phase_7_Plan.md`.
