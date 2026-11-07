# Judge Demo Guide — CodeNexus India 2026

**App:** https://markwise-product-studio.lovable.app

Markwise is a brand-governance workspace: creators draft content, automatic checks
and an AI review flag issues against the workspace's own rules, facts and glossary,
and nothing is published until a human approves it.

Four demo accounts are provided (credentials are shared privately with the
submission, never in this repository). Each account has exactly one role in a
dedicated demo workspace, **Judge Demo — AKS Company**, filled with fictional
demo data. AKS Company is an imaginary company; all demo records are labelled
as fictional.

## The four accounts

| Account | Role | What you can do |
|---|---|---|
| judge.creator | Creator | Create and edit content, submit it, run automatic checks and the AI review, act on findings, send for approval |
| judge.manager | Manager | Read all submitted content, decide items routed to the manager, comment |
| judge.reviewer | Reviewer | Decide items assigned to you, comment |
| judge.admin | Admin | Manage the knowledge base (rules, facts, glossary, palette, fonts, brand profile), see the Users page and the AI-call log. By design, Admins **cannot** read content — governance is separated from content access |

## Suggested 15-minute path

1. **Sign in as Creator.** Open *My Content*. You will find items in every stage:
   a draft you can edit, a checked item with open findings, items awaiting
   approval, and approved / changes-requested / rejected examples.
2. Open **"Launch announcement — onboarding results"** (status: Checked). See the
   automatic findings ("guaranteed" — critical, rule LEGAL-03; "60%" — needs
   checking) and the AI review, which contradicts the 60% claim against approved
   fact FACT-014 ("up to 40%") and suggests the corrected wording. Every AI
   citation is verified server-side before it is shown.
3. Try acting on a finding: accept the suggested rewrite, edit wording yourself,
   or dismiss with a reason. Each action creates a new version and re-runs the
   checks — the audit trail keeps everything.
4. Edit the **draft** ("Welcome email") and submit it to watch the full pipeline:
   automatic checks run immediately, then the AI review.
5. **Sign in as Reviewer.** Your Review queue has one item awaiting your decision
   ("Customer email — rollout plan") and three decided examples. Open the waiting
   item, read the findings and routing reasons, then approve, request changes or
   reject (a comment is required).
6. **Sign in as Manager.** Open *All Content*: "Checklist tips — keep steps short"
   is awaiting a manager decision. Items with legal/claim concerns or unverified
   findings route to a named reviewer instead — you can see the routing reasons
   on each item.
7. **Sign in as Admin.** Open the *Knowledge Base*: 8 rules, 5 verified facts,
   4 glossary terms, 5 brand colours and the brand profile, all editable. Open
   *AI Calls* to see the immutable log of every AI review (model, prompt version,
   what was sent — never the content itself). Note that the Admin cannot open any
   content item: that separation is deliberate.

## Things to know

- **Workspace isolation:** the demo accounts can only see this demo workspace.
  They have no access to any other workspace's data, enforced by row-level
  security in the database (not by the UI).
- **Immutability:** reviews, findings, approval decisions and comments cannot be
  edited or deleted once recorded. Content is versioned; submitted content is
  locked from editing.
- **"Needs checking"** means the AI could not verify a statement against the
  approved sources — it is an honest answer, not a guess. Unverified AI citations
  are downgraded automatically before display.
- **Humans decide:** the system never approves, rejects or publishes anything by
  itself.
- Each account also has an empty personal workspace (created automatically on
  first provisioning) — please stay in **Judge Demo — AKS Company** for the
  demo.

## After judging

The demo workspace can be reset to a clean state (content data purged through a
privileged, audit-preserving database function; demo knowledge reloaded) or the
four accounts can be deleted entirely. Credentials should be rotated or revoked
after the event.
