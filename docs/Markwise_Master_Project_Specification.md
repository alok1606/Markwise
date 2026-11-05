# MARKWISE — MASTER PROJECT SPECIFICATION
## Complete Lovable Full-Stack Application

You are a senior full-stack engineer, SaaS product architect, UI/UX designer, database engineer and AI integration specialist.

Your task is to build **Markwise**, a complete, functional, responsive and deployment-ready pre-publication brand governance platform.

This is a real full-stack application, not a landing-page-only prototype or static UI demonstration.

---

# PART 1 — PRODUCT VISION

## 1. Product identity

**Product name:** Markwise

**Tagline:** Pre-publication brand governance that explains, cites and suggests, while leaving the final decision to people.

**Demo organization:** Nimbus Onboard (fictional SaaS company).

Every demo record must be labelled:

"Demo data: fictional company."

## 2. Problem being solved

Organizations publish content through multiple teams, agencies and AI tools. Their brand guidelines, approved facts, terminology and visual standards are often scattered across documents.

Markwise sits between content creation and publication.

It checks content against an organization's approved:

- Brand guidelines.
- Legal rules.
- Approved facts.
- Glossary and terminology.
- Tone and voice rules.
- Colour palette.
- Accessibility requirements.

Every finding should explain what is wrong, why it matters and which approved source supports the finding.

Markwise must never autonomously edit or publish content.

A human always makes the final decision.

## 3. Core value proposition

"Catch brand, fact, claim and accessibility problems before publication, with an explanation and source for every finding."

---

# PART 2 — NON-NEGOTIABLE DEVELOPMENT RULES

Follow these instructions throughout the entire project.

1. Build actual working features, not static mockups.
2. Do not invent statistics, dashboard metrics, users, findings, citations or activity logs.
3. All statistics must be computed from actual database records.
4. Never invent rule IDs, fact IDs, source documents or quoted passages.
5. AI must use only approved knowledge-base information for grounded claims.
6. If a claim cannot be verified, explicitly return `cannot_verify`.
7. AI must never autonomously approve, edit or publish content.
8. All content changes require an explicit human action.
9. Original content versions must remain immutable.
10. Every important operation must be recorded in an audit log.
11. Never expose secrets or API keys in frontend code.
12. All privileged database operations must be server-side.
13. Enable Row Level Security on every application table.
14. Never trust client-supplied role information.
15. Every protected API and edge function must validate authorization.
16. Use structured AI output with a defined schema.
17. Validate AI responses on the server before saving findings.
18. Never show an unvalidated citation as a verified citation.
19. Use proper loading, empty, success and error states.
20. Do not silently replace a failed feature with a mock implementation.
21. Do not remove an existing working feature while implementing another.
22. Do not make unnecessary architectural changes.
23. Follow the current development phase and do not prematurely implement later phases.
24. If something cannot be implemented with available Lovable capabilities, explain the limitation before substituting another approach.
25. After every phase, report what works, what remains and how to test it.

---

# PART 3 — TECHNOLOGY STACK

Do not change this stack without asking.

## Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- React Router
- React Query for server state
- React Hook Form
- Zod for validation

## Backend

- Lovable Cloud
- PostgreSQL database
- Lovable Cloud Authentication
- Lovable Cloud Storage
- Edge Functions for privileged operations and AI calls

## AI

- Lovable AI.
- Use the available Gemini Flash model with vision support where available.
- Use structured output or tool calling with a defined JSON schema.
- Do not expose AI credentials to the frontend.

If the exact requested model is unavailable, report the available alternative and obtain approval before changing the model.

## Document processing

- pdfjs-dist for browser-side PDF text extraction.
- Browser canvas for image colour analysis.
- OCR only if an appropriate supported implementation is configured.

## Testing

- Vitest.
- React Testing Library.
- Playwright where supported.
- Automated database and authorization tests.

## Deployment

- Lovable publishing for the initial hosted application.
- GitHub integration for source control.
- Vercel for the frontend deployment target, subject to compatibility.
- Lovable Cloud remains the backend unless an explicitly approved migration is performed.

Do not assume Vercel automatically deploys the Lovable Cloud database, authentication, storage or edge functions.

---

# PART 4 — USER ROLES AND PERMISSIONS

Implement four roles.

## 1. Creator

Can:
- Submit content.
- View their own content.
- Run checks.
- View findings.
- Accept suggestions.
- Edit suggestions.
- Dismiss findings with a reason.
- Submit content for approval.
- View their own version history.
- Participate in permitted comments.

Cannot:
- Manage rules or facts.
- Change their own role.
- Access other users' private content without authorization.
- Approve their own high-risk content.

## 2. Manager

Can:
- View organizational content.
- View the insights dashboard.
- Review clean content.
- Approve or reject content assigned to the manager.
- View activity and comments.

Cannot:
- Modify admin-managed knowledge-base records unless separately authorized.

## 3. Reviewer

Can:
- View content assigned to them.
- Review legal and claim findings.
- Approve or reject assigned items.
- Add mandatory review comments.

Cannot:
- Access unrelated private records or modify administrator roles.

## 4. Admin

Can:
- Manage rules.
- Manage approved facts.
- Manage glossary entries.
- Manage colour palettes.
- Import guidelines.
- Review import proposals.
- Manage users and roles.
- Load and remove demo data.
- View system audit information.
- Access insights.

## Role security

Create a separate `user_roles` table.

Never store privileged role assignments as freely editable profile attributes.

Implement a secure `has_role(user_id, role)` function and use it in RLS policies.

Prevent users from escalating their own privileges.

For the demo, provide controlled role testing through administrator-provisioned demo accounts or a server-validated demo signup process.

Demo role selection must never be available in production.

---

# PART 5 — DATABASE DESIGN

Create tables progressively, but keep the final schema consistent.

Required tables:

1. profiles
2. workspaces
3. workspace_members
4. user_roles
5. rules
6. rule_history
7. facts
8. fact_history
9. glossary
10. palette
11. contents
12. content_versions
13. reviews
14. findings
15. approvals
16. comments
17. audit_log
18. ai_calls

## Important fields

### profiles
- id
- full_name
- email
- avatar_url
- created_at

### user_roles
- id
- user_id
- workspace_id
- role
- assigned_by
- created_at

### rules
- id
- workspace_id
- code
- category
- title
- description
- severity
- kind
- pattern (JSONB)
- version
- active
- created_at
- updated_at

### facts
- id
- workspace_id
- code
- statement
- source_note
- version
- active
- created_at
- updated_at

### glossary
- id
- workspace_id
- preferred_term
- avoided_terms
- note

### palette
- id
- workspace_id
- name
- hex

### contents
- id
- workspace_id
- title
- type
- channel
- audience
- goal
- body_text
- file_path
- alt_text
- owner_id
- status
- version
- created_at
- updated_at

### content_versions
- id
- content_id
- version_number
- body_text
- file_path
- changed_by
- change_summary
- created_at

### reviews
- id
- content_id
- content_version_id
- run_at
- status
- dropped_findings_count
- created_at

### findings
- id
- review_id
- source
- category
- severity
- confidence
- span_start
- span_end
- quoted_text
- explanation
- cited_kind
- cited_code
- cited_passage
- outcome
- suggested_text
- final_text
- dismissal_reason
- decided_by
- created_at

### approvals
- id
- content_id
- reviewer_id
- assigned_by
- status
- comment
- decided_at

### comments
- id
- content_id
- user_id
- message
- created_at

### audit_log
- id
- workspace_id
- user_id
- action
- entity_type
- entity_id
- metadata
- created_at

### ai_calls
- id
- content_id
- provider
- model
- prompt_version
- what_was_sent_summary
- status
- created_at

Use UUID primary keys, appropriate foreign keys, indexes, timestamps and constraints.

Store actual foreign-key relationships rather than relying only on textual codes.

Every workspace must be isolated from other workspaces.

All tables must have appropriate RLS policies.

Audit logs must not be editable by ordinary application users.

---

# PART 6 — DESIGN AND USER EXPERIENCE

Create a professional SaaS application.

## Design direction

- Modern enterprise SaaS.
- Clean and calm.
- Light theme as default.
- Neutral backgrounds.
- Navy or charcoal text.
- One restrained accent colour.
- Consistent spacing.
- Professional typography.
- Responsive design.

Use shadcn/ui components.

Avoid:
- Excessive gradients.
- Unnecessary animations.
- Random decorative illustrations.
- Fake dashboard statistics.
- Overcrowded dashboards.
- Inconsistent cards.
- Unnecessary marketing sections.

## Main layout

After login, show:

- Left sidebar.
- Workspace switcher or workspace identity.
- Main content area.
- User profile menu.
- Notifications area where implemented.

Role-specific navigation:

Creator:
- My Content
- New Content

Manager:
- All Content
- Insights

Reviewer:
- Review Queue

Admin:
- Knowledge Base
- Users
- Insights

Shared:
- Profile
- Settings
- Help / Documentation

Protect routes using both frontend authorization and backend/database security.

---

# PART 7 — APPLICATION FEATURES

## A. Landing page

Display:

Product name: Markwise.

Description:

"Pre-publication brand governance that explains, cites and suggests, and leaves the decision to people."

Buttons:
- Sign in
- Sign up
- Try the demo

Do not display invented metrics, testimonials or customer logos.

Include a concise product explanation and a workflow overview.

## B. Authentication

Implement:
- Email/password signup.
- Login.
- Logout.
- Password reset.
- Session persistence.
- Protected routes.
- Role-aware navigation.

Use Lovable Cloud Auth.

## C. Knowledge base

Admin-only area with four tabs:

1. Rules
2. Facts
3. Glossary
4. Palette

Rules:
- Unique rule code.
- Category.
- Title.
- Description.
- Severity.
- Rule kind.
- Pattern.
- Active/inactive status.
- Version history.

Rule categories:
- Legal.
- Claim.
- Terminology.
- Tone.
- Visual.
- Accessibility.

Rule kinds:
- banned_term
- required_phrase
- tone_guidance
- visual

Facts:
- Unique fact code.
- Statement.
- Source note.
- Active status.
- Version history.

Glossary:
- Preferred term.
- Avoided terms.
- Explanation.

Palette:
- Name.
- Hex value.
- Colour preview.

Every modification must preserve the previous version.

## D. Guideline import assistant

Allow admins to:

- Paste guideline text.
- Upload a PDF.
- Extract PDF text.
- Submit extracted text for AI structuring.

The AI proposes structured:
- Rules.
- Facts.
- Glossary entries where supported.

Display proposals in a review interface.

Actions:
- Confirm.
- Edit.
- Discard.

Never save proposed records automatically.

Only extract information actually present in the supplied document.

## E. Content submission

New Content form:

- Title.
- Type.
- Channel.
- Audience.
- Goal.

Supported types:
- Text.
- Image.
- PDF.

Text:
- Rich or plain text editor.
- Character count.
- Save draft.

Image:
- Private file upload.
- Required alt-text field, but allow an empty value so the checker can detect the omission.
- Optional text colour.
- Optional background colour.

PDF:
- Private upload.
- Browser-side text extraction.
- Show extracted text.
- Require creator confirmation before saving the extracted content.

Validate file size, MIME type and file permissions.

Creators can view only their permitted content.

## F. Deterministic checking engine

Create pure TypeScript functions in a separate module with unit tests.

Checks must not use AI.

### Check 1: Banned terms

For each active banned-term rule:
- Match case-insensitively.
- Use whole-word matching where appropriate.
- Identify every occurrence.
- Record exact start and end offsets.
- Record exact quoted text.
- Cite the actual rule record.
- Include the rule description.

### Check 2: Terminology

Check every glossary entry.

Flag avoided terms and cite the corresponding preferred term.

### Check 3: Numeric claims

Extract percentages and numbers with units.

Create claim findings with:
- Outcome: cannot_verify.
- Explanation: Figure needs checking against approved facts.

These findings are provisional and can be resolved by the subsequent AI review.

### Check 4: Image accessibility

Flag missing alt text.

### Check 5: Contrast

When foreground and background colours are supplied:
- Calculate WCAG contrast ratio.
- Flag ratios below 4.5:1 for normal text.
- Display the actual calculated ratio.

### Check 6: Palette validation

Read image colours using browser canvas when technically possible.

Compare them against approved palette colours using CIE76 Delta E.

Flag colours whose distance from every approved palette colour exceeds 25.

If image processing fails because of an unsupported format or browser restriction, report the limitation rather than inventing a result.

Save deterministic findings in the database.

## G. AI review engine

Create a secure edge function called `ai-review`.

Input:
- content_id
- review_id or exact content version identifier.

The edge function must load:
- Content.
- Active rules.
- Active facts.
- Active glossary entries.
- Relevant workspace information.

Never trust the frontend to supply authoritative rules or facts.

### AI system instruction

"Analyze the supplied content using only the supplied approved rules, facts and glossary entries.

Do not use outside knowledge to substantiate company claims.

Every numeric or factual claim must receive one verdict:
- supported
- contradicted
- cannot_verify

For supported or contradicted findings, provide the exact source code and exact supporting passage.

If no approved source supports the claim, return cannot_verify.

Flag tone issues only when an applicable approved tone rule exists.

Do not invent rules, facts, IDs, citations or source passages.

Any suggested rewrite must preserve the author's intended meaning and modify only the relevant flagged text, except when a coordinated sentence-level rewrite is necessary for multiple findings."

### Required response schema

Each finding must contain:
- quoted_text
- verdict
- category
- severity
- confidence
- explanation
- cited_code
- cited_passage
- suggested_text

Use strict structured output.

### Mandatory server-side validation

Reject or downgrade findings when:

1. Quoted text is not an exact substring of the draft.
2. Cited code does not exist in the database.
3. Cited source is inactive or unavailable for that review.
4. Cited passage is not present in the cited source.
5. The finding has invalid offsets.
6. The model returns an invalid schema.

Invalid citations must never be displayed as verified citations.

Downgraded findings become cannot_verify with no verified citation.

Record the number of rejected or downgraded findings.

Deduplicate AI and deterministic findings without losing valid source references.

### Image AI review

Send supported images to the vision model.

Check visible text against supplied rules and facts.

Be transparent that image checks cover visible text and supplied rules only.

### Error handling

Handle:
- Rate limits.
- AI timeouts.
- Invalid structured responses.
- Insufficient AI credits.
- Network errors.
- Unsupported file formats.

Show understandable messages.

Log each AI call, including provider, model, prompt version and a safe summary of the submitted data.

Never store API keys or unnecessarily sensitive content in logs.

## H. Review screen

Build a professional two-column review interface.

Left:
- Original content.
- Highlighted findings.
- Underline and icons in addition to colour.
- Accurate text positions.

Right:
- Findings sorted by severity.
- Category.
- Severity.
- Confidence.
- Exact quoted text.
- Explanation.
- Source rule or fact.
- Cited passage.
- Cannot verify status.
- Suggested rewrite.

Suggestions:
- Show original versus proposed text.
- Show additions and removals.
- Preserve the original content.
- Allow Accept, Edit and Dismiss.

Dismissal requires a reason.

Every action records:
- User.
- Time.
- Outcome.
- Final text where applicable.

Accepting or editing creates a new immutable content version.

Use zero-based offsets and a documented end-exclusive span convention. Account for Unicode text and ensure highlighted spans correspond to the exact version reviewed.

## I. Approval workflow

Creators can submit content when no unresolved high or critical findings remain.

Routing:

If content contains claim findings, legal findings or cannot_verify claims, require selection of a named authorized reviewer.

Otherwise, route it to the manager queue for clean-content approval.

Reviewer:
- View assigned items.
- Inspect findings.
- Approve or reject.
- Provide mandatory comments.

Manager:
- View all permitted content.
- Filter by status.
- Approve clean content.
- Reject content with a reason.

Comments:
- Display threaded discussion.
- Show author and timestamp.

Maintain activity history.

Define and validate legal status transitions so users cannot skip approval stages or approve unauthorized items.

## J. Insights dashboard

Admin and manager only.

All metrics must be calculated from database data.

Include:

- Findings by category.
- Findings by severity.
- Findings by owner.
- Open versus decided findings.
- AI citation validity percentage.
- Findings rejected or downgraded by validation.
- Most frequently dismissed rules.
- Common dismissal reasons.
- Content approval trends where sufficient data exists.

Possibly unclear rules:
Show rules dismissed at least three times.

Include:
"This is a basic version based on dismissal counts."

Never fabricate chart data.

Display proper empty states.

## K. AI transparency page

Create a public page called:

"How Markwise Uses AI"

Explain:
- Which AI provider and model are used.
- What content is sent for analysis.
- That approved rules and facts are supplied to the AI.
- That citations are independently validated.
- That cannot_verify is a legitimate result.
- That AI suggestions are not automatically accepted.
- That humans retain final control.
- What information is logged.
- Applicable retention and deletion controls.
- Links to the relevant provider terms.

Do not make unsupported claims about external AI providers' data-training policies.

## L. Demo data

Create demo data for Nimbus Onboard.

Clearly label every seeded record as fictional demo data.

Seed:
- 8 rules.
- 5 approved facts.
- 4 glossary entries.
- 5 palette colours.

Mandatory records:

Rule:
`LEGAL-03`

Description: Restricts the use of the word "guaranteed".

Fact:
`FACT-014`

Statement:
"Reduces onboarding time by up to 40% (2025 customer study)."

Glossary example:
Preferred term: customers.
Avoided term: clients.

Provide:
- Load demo data.
- Remove demo data.

Only admins can execute these operations.

Make seed operations idempotent and prevent accidental deletion of real user data.

## M. Mandatory end-to-end test

Use this approved fact:

FACT-014:
"Reduces onboarding time by up to 40% (2025 customer study)."

Use this rule:

LEGAL-03:
Restricts the word "guaranteed".

Draft:

"We cut onboarding time by 60%, guaranteed!"

Expected:

1. `60%` is contradicted by FACT-014, with a valid citation.
2. `guaranteed` is flagged by LEGAL-03, with a valid citation.
3. The suggested rewrite should preserve meaning without unsupported claims.

Example:

"Customers reduced onboarding time by up to 40%."

Also test a claim that has no approved supporting fact.

Expected outcome:
cannot_verify.

---

# PART 8 — SECURITY AND QUALITY REQUIREMENTS

Implement:

- RLS for every application table.
- Workspace-level isolation.
- Secure authorization checks.
- Server-side role validation.
- Secure storage policies.
- File upload validation.
- Protected edge functions.
- Environment-based configuration.
- Rate limiting for expensive AI operations where supported.
- Safe error handling.
- Audit logging.
- Database constraints and indexes.

Never allow ordinary users to:
- Modify their role.
- Access another workspace.
- View unauthorized content.
- Change audit records.
- Bypass reviewer assignment.
- Approve restricted content.

Implement WCAG 2.1 AA-oriented accessibility:
- Keyboard navigation.
- Visible focus states.
- Proper labels.
- Accessible dialogs.
- Contrast requirements.
- Alternative text.
- Screen-reader-friendly status indicators.

---

# PART 9 — TESTING REQUIREMENTS

Build automated tests for:

1. Authentication.
2. Role permissions.
3. RLS.
4. Content submission.
5. Banned-term detection.
6. Terminology checks.
7. Numeric claim extraction.
8. Contrast calculation.
9. Citation validation.
10. Invalid AI responses.
11. Duplicate findings.
12. Version history.
13. Reviewer assignment.
14. Approval transitions.
15. Audit logs.

Test the complete workflow:

Creator → Submit → Run Check → Review Findings → Accept/Edit/Dismiss → Submit for Approval → Reviewer/Manager → Final Decision → Activity Log.

Run a production build.

Report actual test results.

Do not report passing tests that were not executed.

---

# PART 10 — GITHUB AND DEPLOYMENT

## GitHub

Connect the Lovable project to GitHub.

Repository name:
`markwise`

The repository should contain the complete source code and all required configuration.

Include:
- README.md
- .gitignore
- .env.example where appropriate
- package.json
- Dependency lockfile
- TypeScript configuration
- Database migrations
- Seed scripts
- Edge functions
- Documentation
- Testing configuration

Never commit:
- API keys.
- Passwords.
- Database credentials.
- Private user data.
- Production secrets.

Document setup instructions so another developer can clone the repository and understand the project.

## Vercel

Prepare the Vite frontend for Vercel.

Requirements:
- Production build configuration.
- Correct SPA routing fallback.
- Environment variables.
- Correct API endpoint configuration.
- Correct production frontend URL.
- Authentication redirect configuration where applicable.
- Verification of database and edge-function connectivity.

Keep Lovable Cloud as the backend.

Do not claim that Vercel hosts the Lovable Cloud backend.

Provide clear instructions for the Vercel frontend and Lovable Cloud backend to work together.

Verify the deployed application, not just the local preview.

## Documentation

Create:
- README.md
- Architecture documentation.
- Database schema documentation.
- API documentation.
- Environment variable documentation.
- Testing guide.
- Deployment guide.

---

# PART 11 — DEFINITION OF DONE

Markwise is complete only when:

1. The landing page works.
2. Authentication works.
3. All four roles work securely.
4. The knowledge base works.
5. Guideline import works.
6. Content submission works.
7. Deterministic checks work.
8. AI review works.
9. Citations are server-validated.
10. Review decisions work.
11. Version history works.
12. Approval workflow works.
13. Insights are database-driven.
14. Audit logs work.
15. Demo data works.
16. Automated tests have been executed.
17. Production build succeeds.
18. GitHub repository is synchronized.
19. Deployment configuration is ready.
20. The deployed application has been verified.

If any item is incomplete, identify it explicitly.

Never describe an incomplete feature as complete.

---

# PART 12 — WORKING METHOD

Do not implement the entire application in one operation.

Wait for the user to provide individual phase instructions.

After each phase:

1. Implement only the requested scope.
2. Preserve previous functionality.
3. Run relevant tests.
4. Inspect for errors.
5. Fix problems introduced by the current phase.
6. Explain completed functionality.
7. Explain remaining functionality.
8. Give manual testing instructions.
9. Report important database or architectural changes.
10. Wait for approval before the next phase.

If a requirement conflicts with the existing implementation, explain the conflict and propose a safe solution.

Start by confirming your understanding of the complete specification.

Do not build anything until the first development phase is explicitly provided.