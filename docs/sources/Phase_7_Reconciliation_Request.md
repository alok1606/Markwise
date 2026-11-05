I am providing the official hackathon Round 2 and Round 3 requirements, our original Round 1 proposal, the Round 2 Pack, and the Phase 7 plan you previously generated.

Your task is to **reconcile and finalize the Phase 7 implementation plan. Do not implement anything yet.**

### 1. Read and compare all source documents

Read these documents completely:

1. Markwise Round 1 Plan — original proposal.
2. Markwise Round 2 Pack — actual Round 2 implementation plan and submission commitments.
3. Official hackathon Round 2 and Round 3 requirements — judging criteria, submission requirements and rules.
4. Your previously generated Phase 7 plan.
5. Existing Master Specification, Project_Status.md, and Phase 1–6 implementation and testing reports in this project, if available.

Treat the official hackathon requirements and our Round 2 submission as authoritative when determining what must be delivered for Round 3.

Do not assume a feature is complete just because it appears in a plan. Verify its actual implementation, routes, database, server functions and tests wherever possible.

### 2. Preserve our three exact Round 3 commitments

These three improvements were explicitly submitted in our Round 2 Pack. They are mandatory deliverables, not optional enhancements.

**Improvement 1 — Measured accuracy harness**
- A labelled dataset containing clean and flawed drafts.
- Precision, recall, F1, hallucinated-citation rate and cannot_verify correctness.
- Compare Markwise against the same AI model without brand guidelines.
- Reproducible runs, stored results and AI variance reporting.

**Improvement 2 — Fact-change impact scan**
- Detect affected approved and in-progress content when facts or rules change.
- Combine exact matching with pgvector semantic search.
- Re-run relevant checks.
- Flag potentially outdated content.
- Notify the content owner and assigned reviewer.
- Preserve existing historical reviews, findings, approvals and versions.

**Improvement 3 — DOCX and PowerPoint review**
- Support Word and PowerPoint uploads.
- Extract paragraphs, tables, slide text, speaker notes and image alt text.
- Anchor findings to exact paragraphs or slides.
- Show suggested edits in the relevant location.
- Preserve original uploaded files and content versions.

Do not weaken, replace or rename these commitments to make implementation easier.

### 3. Audit Round 2 features against the actual project

Check every feature in Part B and Part C of the Round 2 Pack.

Pay particular attention to:

- Authentication and four roles.
- Knowledge Base and version history.
- Guideline import assistant.
- Text, image and PDF submission.
- Deterministic checks.
- AI review and citation validation.
- Cannot verify handling.
- Accept, edit and dismiss actions.
- Immutable content versions.
- Manager and Reviewer approval workflows.
- Insights dashboard.
- AI transparency page.
- Nimbus Onboard demo data.
- End-to-end test case.
- GitHub and Vercel deployment documentation.

For every feature, classify it as:

1. Completed and verified.
2. Implemented but not fully verified.
3. Partially implemented.
4. Not implemented.

Do not claim completion without evidence. Identify missing tests and known limitations.

### 4. Reconcile the original proposal with the actual implementation

Explain:

- What was originally proposed in Round 1.
- What was delivered in Round 2.
- What changed and why.
- What remains incomplete.
- What must be completed for Round 3.

Preserve the actual architecture. Do not change the existing React/Vite/TypeScript and Lovable Cloud implementation without a strong technical reason.

Document the actual use of TanStack Start server functions rather than incorrectly claiming that the backend uses Edge Functions or FastAPI.

### 5. Revise the Phase 7 roadmap

Retain the three separate workstreams:

- Phase 7A: Accuracy harness.
- Phase 7B: DOCX/PPTX review.
- Phase 7C: Fact-change impact scan.

For each, provide:
- Scope and implementation details.
- Database changes.
- Frontend and backend changes.
- Security and workspace isolation requirements.
- Unit, integration, security and browser tests.
- Acceptance criteria.
- Cost and performance considerations.
- Dependencies and risks.

Also identify any unfinished Round 2 features that must be completed before or alongside these workstreams.

Do not mark an unfinished feature as complete merely because it is included in the roadmap.

### 6. Add the Round 3 submission requirements

Prepare a final submission checklist covering:

- Final working project URL.
- Final source-code repository.
- Updated product PDF.
- Complete list of implemented features.
- Technical architecture and implementation summary.
- All three Round 3 improvements and evidence of delivery.
- Testing details and results.
- Product roadmap and future development plan.
- Individual participant role and actual contribution.

Include an accurate disclosure of Lovable, AI tools, libraries, APIs, frameworks and other significant development tools.

Do not invent development history, test results, user feedback or completed features.

### 7. Important technical decisions

Review these proposed decisions and identify any risks before implementation:

- PostgreSQL vector extension for semantic retrieval.
- Browser-side JSZip-based DOCX/PPTX parsing.
- Configurable AI evaluation cost caps.
- Configurable impact re-review limits.
- Neutral summaries for non-Admin users instead of exposing Admin-only Knowledge Base wording.
- No generated edited DOCX/PPTX files unless explicitly approved.

### 8. Final response required

Return:

1. A comparison of Round 1, Round 2 and Round 3 requirements.
2. A verified Round 2 feature-completion audit.
3. A list of remaining gaps.
4. A revised Phase 7A, 7B and 7C implementation plan.
5. A final Round 3 acceptance checklist.
6. Any decisions that still require my approval.
7. An estimate of AI credits, Lovable Cloud usage and implementation risks.

Update the planning documentation only after presenting the revised plan for my review.

**STRICT INSTRUCTION: PLAN ONLY. DO NOT WRITE OR MODIFY APPLICATION CODE, DATABASE SCHEMAS, MIGRATIONS, SERVER FUNCTIONS, UI COMPONENTS OR EXISTING FEATURES. DO NOT START PHASE 7A.**

Wait for my explicit approval before implementing anything.