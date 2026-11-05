# Phase 4 — Deterministic Checking Engine (plan for approval)

Source: Master Specification Part 7 F (Deterministic checking engine) and Part 5 (reviews, findings). The specification has no numbered phase list; this plan treats Phase 4 as the non-AI checks that run on submitted content, as anticipated in the Phase 3 plan. If your Round 2 build plan defines Phase 4 differently, send it and this plan will be adjusted.

## What users get
- When a Creator submits content, Markwise runs automatic checks on that exact version and saves the results as findings.
- Creator sees the findings on their own submitted content; Manager sees findings for submitted content in their workspace (read-only).
- Each finding shows: what was found, the exact quoted text and its position, severity, and the rule, glossary entry or measurement it is based on.
- No AI, no approve/reject, no editing of findings, no reviewer assignment in this phase.

## The six checks (pure functions, no AI)
1. Banned terms: every active banned-term rule; case-insensitive, whole-word where appropriate; every occurrence with exact start/end and quoted text; cites the rule code and description.
2. Terminology: every glossary entry; flags avoided terms (respecting case sensitivity) and cites the preferred term.
3. Numeric claims: extracts percentages and numbers with units; outcome "cannot_verify", explanation "Figure needs checking against approved facts." Provisional — for the later AI review.
4. Image accessibility: flags missing alt text.
5. Contrast: when text and background colours are given, calculates WCAG ratio, flags below 4.5:1, shows the actual ratio.
6. Palette: reads image colours in the browser (canvas) and compares them with approved palette colours using CIE76 Delta E; flags colours further than 25 from every palette colour. If the image cannot be read, records a "could not check" limitation instead of a result.

Text checks run on body text (Text, and confirmed PDF text). Image checks run on Image content.

## Database
- `reviews`: content_id, content_version_id, workspace_id, run_at, status (completed / partial), dropped_findings_count.
- `findings`: fields from the specification; source = "deterministic"; outcome, suggested_text, final_text, dismissal_reason, decided_by left empty for later phases.
- Read-only through the database API; written only by a checked server-side database function that confirms the content is submitted, the version matches, and the caller owns it. Audit event "review_completed".
- Read access: content owner and workspace Managers (same rule as reading the content). Admin and Reviewer denied, matching Phase 3. Signed-out: no privileges.
- Knowledge Base stays Admin-only: the server reads rules, glossary and palette for the content's workspace with elevated access inside the check, never widening Knowledge Base access.

## Flow
```text
Creator submits -> server loads exact version + workspace rules/glossary/palette
 -> runs pure checks (text) ; browser supplies image colour sample (palette)
 -> server validates findings (offsets match quoted text, cited codes exist)
 -> saves review + findings, drops invalid ones (counted) -> audit event
```
Palette colours come from the browser, so the server treats them as an untrusted sample: it re-validates the format and never lets them affect non-palette findings.

## Screens
- Content detail: new "Automatic checks" section with findings grouped by check, highlighted quotes in the text, contrast ratio and colour swatches, and "could not check" notes.
- My Content / All Content: finding counts per item.

## Permissions
| | Creator | Manager | Reviewer | Admin |
|---|---|---|---|---|
| Trigger checks | Own content, on submit | No | No | No |
| Read findings | Own content | Submitted content, own workspace | No | No |
| Change findings | No | No | No | No |

## Tests and acceptance
- Unit tests per check with exact offsets, case/whole-word cases, unicode, overlapping terms, contrast ratios against known WCAG values, Delta E reference values, empty inputs.
- Live tests with temporary accounts across two workspaces: only owners trigger; findings tied to the exact version; direct writes refused; Manager read in own workspace only; Admin/Reviewer/other workspace denied; no Knowledge Base leakage.
- Regression: Phase 1–3 suites, browser check of submit → findings.
- Acceptance: all six checks produce correct saved findings for real submissions; tests pass; no security regressions.

## Out of scope (later phases)
AI review and resolving claims against facts, review screen decisions, approval workflow, comments, insights, AI transparency.

## Still open from Phase 1
One-hour session persistence (deferred) and 11 skipped Phase 1 live tests.
