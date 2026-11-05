# Markwise Round 2 Pack

Lovable prompts and form answers, built from the Round 1 plan.

## How to use this

1. Open a new Lovable project. Paste **Part A** as your first message. If Lovable has a Knowledge / Project instructions box, paste it there as well so it never forgets the rules.
2. Send **Part B** steps **one at a time**. Wait until a step works, test it, then send the next. Never send two steps together.
3. If Lovable asks to enable **Lovable Cloud** (database, login, edge functions) or **Lovable AI**, say yes. No API key is needed.
4. Publish the project. Then fill the form using **Part C**, and edit any line that is not true of your final build.

## Part A: Master prompt (send first)

```
You are building "Markwise": a pre-publication brand governance web app. It checks a draft (text, image or PDF) against an organisation's own approved guidelines, facts, glossary and colour palette BEFORE it is published. Every finding cites the exact source rule or fact. The AI only suggests. A human always makes the final decision.

DEMO COMPANY: a fictional SaaS company called "Nimbus Onboard". All demo data is fictional and must be labelled "Demo data: fictional company".

## HARD RULES FOR YOU (the builder). Follow these in every step.
1. Build ONLY what the current step message lists. Do not add pages, features, pricing, testimonials, team photos, logos or marketing claims that I did not ask for.
2. NEVER show fake numbers. Every number on every screen must be computed from the database. If there is no data, show an empty state such as "No findings yet".
3. NEVER invent rule IDs, fact IDs, sources or quotes. Citations must come from rows that exist in the database.
4. If something is unclear or not possible with the available tools, STOP and ask me. Do not guess, and do not silently build a fake version. If a feature cannot work, show a visible "Not available yet" label and tell me in your reply.
5. AI never edits, approves or publishes anything by itself. Every change needs a human click.
6. Security: user roles live in a SEPARATE table called user_roles (never on the profile table). Use a security-definer function has_role(user_id, role) inside RLS policies. Turn on RLS for every table. No secrets or API keys in frontend code. All AI calls happen in edge functions.
7. AI calls must use structured output (tool calling with a JSON schema) so results can be validated. Never parse free text with regex.
8. Accessibility: the app's own UI must follow WCAG 2.1 AA: keyboard navigation, visible focus, labelled form fields, contrast of at least 4.5:1, alt text on images, no information by colour alone.
9. Design: clean, calm, professional, light theme, neutral greys plus one accent colour. Use shadcn/ui components. Must work on mobile and desktop.
10. After each step, end your reply with: (a) what is now working, (b) what is NOT built yet, (c) how I can test it.

## TECH (do not change)
React + Vite + TypeScript + Tailwind + shadcn/ui. Backend: Lovable Cloud (Postgres, auth, storage, edge functions). AI: Lovable AI (use the Gemini Flash model it offers, which accepts images). PDF text is extracted in the browser with pdfjs-dist. There is NO vector database in this round: the knowledge base is small, so the active rules and facts are sent to the model in full, with their IDs.

## ROLES
creator, manager, reviewer, admin.
- creator: submits content, sees own content, accepts/edits/dismisses suggestions.
- manager: sees all content and the insights dashboard, gives final approval for clean content.
- reviewer: reviews items escalated to them (claims and legal), approves or rejects with a comment.
- admin: manages the knowledge base (rules, facts, glossary, palette) and user roles.
DEMO MODE: one constant DEMO_MODE = true. While true, the sign-up form shows a role dropdown with the notice "Demo workspace: pick any role to try the product". When false, new users are creators and only admins can change roles. Turn on auto-confirm for email sign-up so judges can sign in immediately.

## DATA MODEL (create progressively, only the tables a step needs)
profiles; user_roles; rules (code like LEGAL-03, category, title, description, severity, kind, pattern jsonb, version, active); rule_history; facts (code like FACT-014, statement, source_note, version, active); fact_history; glossary (preferred_term, avoided_terms[], note); palette (name, hex); contents (title, type text|image|pdf, channel, audience, goal, body_text, file_path, alt_text, owner_id, status draft|checked|needs_review|approved|rejected, version); content_versions; reviews (content_id, version, run_at); findings (review_id, source deterministic|ai, category, severity, confidence, span_start, span_end, quoted_text, explanation, cited_kind rule|fact|glossary|palette|none, cited_code, cited_passage, outcome open|accepted|edited|dismissed|cannot_verify, suggested_text, final_text, dismissal_reason, decided_by); approvals; comments; audit_log; ai_calls (content_id, provider, model, what_was_sent_summary, created_at).

Reply to confirm you understood. Do NOT build anything yet. List any question you have.
```

## Part B: Step prompts (send one at a time)

### Step 1: Foundation, login, roles (owner: Alok)

```
STEP 1 of 8: Foundation. Build only this.
- Landing page: product name, one-sentence description ("Pre-publication brand governance that explains, cites and suggests, and leaves the decision to people."), and Sign in / Sign up buttons. No fake stats, no testimonials.
- Auth with email and password. Sign-up form includes the DEMO_MODE role dropdown described in the master prompt. Store the role in user_roles.
- Create profiles, user_roles, has_role(), and RLS.
- App shell after login: sidebar with links shown per role. creator: My Content, New Content. manager: All Content, Insights. reviewer: Review Queue. admin: Knowledge Base, Users. Pages can be empty placeholders titled "Coming in a later step".
- Admin Users page: list users and change a role (admin only).
Test: sign up four users with four roles and confirm each sees only their own links, and that a creator cannot open admin URLs.
```

### Step 2: Knowledge base (owner: Arvind)

```
STEP 2 of 8: Knowledge base. Admin only. Build only this.
- Tables rules, rule_history, facts, fact_history, glossary, palette.
- CRUD pages with tabs: Rules, Facts, Glossary, Palette.
- Rules have: code (unique, e.g. LEGAL-03), category (legal, claim, terminology, tone, visual, accessibility), title, description, severity (low, medium, high, critical), kind (banned_term, required_phrase, tone_guidance, visual), pattern (for banned_term: a list of words or phrases), and active flag.
- Facts have: code (unique, e.g. FACT-014), statement, source_note, active.
- Versioning: when an admin edits a rule or fact, copy the old row into the history table and increase the version number. Show version history on the item.
- Import assistant: admin pastes guideline text, or uploads a PDF whose text is extracted in the browser with pdfjs-dist. An edge function asks the AI to PROPOSE structured rules and facts as JSON (structured output). Show each proposal in a review list with Confirm / Edit / Discard. NOTHING is saved until the admin confirms it. The AI must only use text actually present in the pasted document and must not invent rules.
Test: add LEGAL-03 and FACT-014 by hand, edit one and see the version history, then import a short pasted text and confirm that only the confirmed items are saved.
```

### Step 3: Submit content (owner: Niket)

```
STEP 3 of 8: Submit content. Build only this.
- New Content form: title, type (text / image / PDF), channel (web, social, email, other), audience, goal.
- Text: a text area. Image: upload to a private storage bucket, with a REQUIRED alt text field (it may be left blank, but then a finding will be raised later). Also two optional fields for the text colour and background colour as hex, for a contrast check. PDF: upload, extract text in the browser with pdfjs-dist, show the extracted text for the creator to confirm.
- Save as contents with status draft. Creators see only their own items on My Content, with status badges. RLS enforces this.
- A "Run check" button that for now only shows "Checks come in the next steps".
Test: create one item of each type and confirm it shows in My Content and that another user cannot see it.
```

### Step 4: Deterministic checks (owner: Alok)

```
STEP 4 of 8: Deterministic checks. These must NOT use AI. Build only this.
Implement pure TypeScript functions (in a separate file, with unit tests) that run when the creator clicks "Run check":
1. Banned terms: for every active rule of kind banned_term, find each case-insensitive whole-word match in the text. Create a finding with category, severity from the rule, the exact span (start, end) and quoted text, cited_kind = rule, cited_code = rule.code, and cited_passage = the rule description.
2. Terminology: for every glossary entry, flag any avoided term and cite the glossary entry with its preferred term.
3. Numeric claims: extract every percentage and number-with-unit from the text and list each as a finding of category "claim", outcome "cannot_verify", explanation "Figure needs checking against approved facts". (The AI step later checks these. Do not judge them here.)
4. Images: if alt text is empty raise an accessibility finding. If both colours were entered, compute the WCAG contrast ratio and flag it below 4.5:1 and show the number. Read the image's dominant colours in the browser (canvas) and flag any colour whose distance from every palette colour (CIE76 delta E) is above 25, showing the distance.
Save a reviews row and findings rows (source = deterministic). Show the findings in a simple list for now.
Test with this text: "We cut onboarding time by 60%, guaranteed!" with a banned_term rule LEGAL-03 containing the word "guaranteed". You must get a LEGAL-03 finding on "guaranteed" and a cannot_verify finding on "60%". Show me the unit test results.
```

### Step 5: AI check with citations (owner: Arvind)

```
STEP 5 of 8: AI check. This is the most important step. Build only this.
Create an edge function ai-review. Input: content_id. The function itself loads the content, and all ACTIVE rules, facts and glossary entries from the database (never trust the client for these). It calls Lovable AI with structured output (tool calling) and a strict system prompt: "Use ONLY the supplied rules and facts. Each claim in the draft must get a verdict: supported, contradicted, or cannot_verify. For supported and contradicted you must give the cited code and quote the exact passage from that source. If no supplied source covers the claim, the verdict MUST be cannot_verify. Do not use outside knowledge. Also flag tone problems only against the supplied tone rules."
Response schema per finding: quoted_text (exact substring of the draft), verdict, category, severity, confidence (low/medium/high), explanation, cited_code (or null), cited_passage (or null), suggested_text (replacement for ONLY the flagged span, preserving the author's meaning, or null).
SERVER-SIDE VALIDATION (mandatory): drop or downgrade any finding where (a) quoted_text is not an exact substring of the draft, (b) cited_code does not exist in the database, or (c) cited_passage is not text found in the cited row. Downgraded findings become cannot_verify with no citation. Count how many findings were dropped and store it on the review row.
For images: send the image to the vision model, ask it to read any visible text and to check it against the same rules and facts, with the same validation. Be honest in the UI that the checks on images are limited to visible text and the rules supplied.
Log every call in ai_calls (provider, model, short summary of what was sent). Handle rate limit (429) and credit (402) errors with a clear message in the UI. Merge AI findings with the deterministic ones and remove duplicates on the same span.
Test: with FACT-014 = "Reduces onboarding time by up to 40% (2025 customer study)" and LEGAL-03 on "guaranteed", the draft "We cut onboarding time by 60%, guaranteed!" must give: 60% contradicts FACT-014 (cited), "guaranteed" restricted by LEGAL-03 (cited), and the suggested text "Customers reduced onboarding time by up to 40%." or close to it. Then test a claim that no fact covers: it must come out as cannot_verify, not a guess.
```

### Step 6: Review screen (owner: Niket)

```
STEP 6 of 8: Review screen. Build only this.
- Two-column page. Left: the content with every finding's span highlighted (use an icon plus an underline style, not colour alone). Right: the findings list, sorted by severity.
- Each finding card shows: what was found, where (the quoted text), why, the cited source (code, title and the quoted passage), severity, confidence, and a clear "Cannot verify" badge where it applies.
- If there is a suggested_text, show it as a diff against the original (removed text struck through, added text underlined) limited to the flagged span.
- Buttons: Accept (apply suggestion), Edit (change the suggestion then apply), Dismiss (reason is REQUIRED). Record outcome, final_text, dismissal_reason and decided_by.
- Accept or Edit creates a new row in content_versions and increases the version number. The original is never overwritten. Show a version list with a view-old-version option.
- Write every decision to audit_log.
Test: run the Step 5 test case, accept the suggestion, and confirm that version 2 exists and version 1 is unchanged.
```

### Step 7: Approval workflow (owner: Alok)

```
STEP 7 of 8: Approval workflow. Build only this.
- A "Submit for approval" button for creators, enabled when no finding with outcome "open" and severity high or critical remains.
- Routing: if the content has any decided finding of category claim or legal, or any cannot_verify claim finding, it goes to a NAMED reviewer: the creator picks one reviewer user from a dropdown, required. Otherwise it goes to the manager queue as "clean".
- Reviewer Review Queue: shows items assigned to them with the findings and cited sources. Buttons Approve / Reject with a required comment.
- Manager page: All Content with filters by status. Managers can approve clean items.
- Comments thread on each content item (any involved user). Status badges update: needs_review, approved, rejected.
- Everything is written to audit_log and visible on an Activity tab of each item.
Test: a creator submits the Step 5 draft, picks a reviewer, the reviewer approves with a comment, and the activity log shows each step with names and times.
```

### Step 8: Insights, transparency, demo data (owners: Kapil and Arvind)

```
STEP 8 of 8: Insights, transparency, demo data. Build only this.
1. Insights page (manager and admin). Computed ONLY from the database: findings by category; findings by owner (team); open vs decided; the share of AI findings that have a valid citation; the number of AI findings dropped by validation. "Possibly unclear rules": list every rule that was dismissed 3 or more times, with the count and the dismissal reasons. Empty states where there is no data. Add a text note: "This is a basic version based on dismissal counts."
2. A public "How Markwise uses AI" page: states which provider and model are used, what is sent (the draft plus the active rules and facts), that nothing is auto-edited, that "cannot verify" is a valid result, and that content is not used by us to train models. Do not claim anything about the provider's own training policy beyond what the provider states; write "see the provider's terms".
3. Seed data, clearly labelled "Demo data: fictional company" (Nimbus Onboard): 8 rules including LEGAL-03 (restricts the word "guaranteed"), 5 facts including FACT-014 ("Reduces onboarding time by up to 40% (2025 customer study)"), 4 glossary entries (for example prefer "customers", avoid "clients"), 5 palette colours. A "Load demo data" button for admins, and a "Remove demo data" button.
4. Add a short "Try the demo" section on the landing page that shows the Round 1 test sentence and says how to sign up and run it. No invented results.
Then run a final self-audit and report honestly: which features work, which are partial, and which are not built. Do not claim a feature works unless you have tested it.
```

## Part C: Round 2 form answers

**Edit before submitting.** The form says "list only what is finished and working". Delete any line you could not get working in your final build.

### The list of features you completed

```
Email sign-up and login with four roles (creator, manager, reviewer, admin) enforced by database security rules
Admin knowledge base: rules, facts, glossary and colour palette with version history
Guideline import: AI proposes rules from pasted text or a PDF, and nothing is saved until the admin confirms it
Submit text, image or PDF content with channel, audience and goal
Deterministic checks: banned terms, glossary terminology, numeric claim detection, alt text, WCAG contrast, off-palette colours
AI claim and tone check that uses only approved rules and facts
Every AI finding carries a citation that is validated against the database, and invalid citations are dropped
"Cannot verify" outcome when no approved source covers a claim
Suggested rewrites shown as a diff limited to the flagged span
Accept, edit or dismiss each suggestion, with a required reason on dismissal
Version history: the original is never overwritten
Approval workflow with named reviewer routing, comments and an activity log
Insights dashboard: findings by category and team, citation rate, and rules often dismissed
"How Markwise uses AI" transparency page and a log of AI calls
Demo data for a fictional company, including the FACT-014 and LEGAL-03 test case
```

### Technology and implementation details

```
Stack: React, Vite, TypeScript, Tailwind and shadcn/ui on the front end. Lovable Cloud (Postgres, authentication, file storage, edge functions) on the back end. AI is called only from edge functions through Lovable AI (a Gemini Flash model, which also reads images).

Architecture: The browser extracts PDF text (pdfjs-dist) and reads image colours (canvas). The deterministic engine is pure TypeScript with unit tests and runs first. The ai-review edge function loads the active rules, facts and glossary from the database itself, sends them with their IDs to the model, and requires structured output through tool calling. Roles are stored in a separate user_roles table and enforced with row-level security and a has_role() function.

Technically hard parts: (1) Anti-hallucination validation. Every AI finding is checked on the server. The quoted text must be an exact substring of the draft, the cited code must exist in the database, and the cited passage must be found in the cited row. Anything that fails is dropped or turned into "cannot verify". (2) Span-accurate highlighting and diffs, so a suggestion replaces only the flagged text. (3) Immutable versioning of content, rules and facts. (4) Risk-based approval routing.

Honest limits: the knowledge base is sent to the model in full instead of using vector retrieval, so it suits small guideline sets. Image checks cover visible text, alt text and colours only. DOCX and slides are not supported yet.
```

### Your three improvements for Round 3

```
1. Measured accuracy harness: a built-in evaluation page with a labelled set of flawed and clean drafts. It reports precision, recall, hallucinated-citation rate and "cannot verify" correctness, and compares Markwise against the same model run without our guidelines, so the accuracy claims are proven by numbers anyone can rerun.

2. Fact-change impact scan: when an admin edits a fact or rule, the system finds every approved or in-progress item affected by the change (semantic search with pgvector embeddings plus exact checks), re-runs the checks, flags newly outdated content and notifies the owner and the reviewer. This solves the "outdated information" failure pattern from our plan.

3. DOCX and slide-deck review with location-anchored findings: upload Word files and PowerPoint decks, parse them into paragraphs and slides, and show each finding pinned to its exact slide or paragraph (including text in slide notes and image alt text), with the suggested edit shown in place.
```

### What changed from your original proposal, and why

```
Stack changed: the plan said Next.js and FastAPI. We built on React/Vite with Lovable Cloud (Postgres, auth, storage, edge functions) so that the whole product could be built, deployed and run by anyone through one link in the build window. The AI is called through Lovable AI instead of a separately configured API.

Retrieval changed: the plan said PostgreSQL with pgvector. In this round the active rules and facts are sent to the model in full, with IDs, because the demo knowledge base is small and exact IDs matter more than similarity search. We moved the vector retrieval to Round 3 (improvement 2), where the knowledge base grows and re-checking at scale needs it.

Added: server-side citation validation. During the build we saw that asking the model to cite is not enough, so we now verify every citation against the database and drop what fails. This strengthens our Round 1 improvement 1.

Added: a guidelines import assistant with mandatory admin confirmation, and a log of every AI call.

Dropped or postponed: the asset library (we only support a colour palette), logo clear-space checks, DOCX and slides, tone scoring per channel, and the Slack or CMS plugin. Guideline-gap insights are a basic version: rules dismissed 3 or more times are flagged as possibly unclear. Detection of contradicting rules is not built.

Demo mode: sign-up lets a visitor pick any role so judges can try every part without waiting for an admin. One setting turns this off for real use.

Not changed: the seven-step workflow, the four roles, the human-decides principle, and the FACT-014 / LEGAL-03 test case from Round 1.
```

## Part D: Before you submit

- Open the published link in a **private window** and sign up with a fresh email. It must load for anyone.
- Make the GitHub repository **public** (Lovable: connect GitHub in the project settings, then check the repo visibility on GitHub).
- Run the FACT-014 / LEGAL-03 test sentence end to end and screenshot it for the PDF.
- Upload the updated PDF to Drive, set sharing to "Anyone with the link" as Viewer, and open it in a private window.
- Re-read every line under "features completed" and delete anything that is not truly working.
