# Nimbus Onboard end-to-end demo (Round 2 polish, Task 3)

Run: 5 Nov 2026, about 16:00–16:06 UTC, local preview, real AI review. Temporary accounts in two temporary workspaces (A: demo, B: isolation check). All deleted afterwards.
Screenshots: `docs/evidence/nimbus-demo/` (file prefix = step number).

## Steps and observed results
1. **Admin** loaded demo data through the Knowledge Base button (1). Rules list shows LEGAL-03 (2); facts list shows FACT-014 (3).
2. **Creator** saved and submitted "We cut onboarding time by 60%, guaranteed!" (v1) (4, 5).
3. **Findings on v1 (actual):**
   | Source | Quoted | Outcome | Severity | Citation |
   |---|---|---|---|---|
   | Automatic | "guaranteed" | violation | critical | LEGAL-03 (rule) |
   | Automatic | "60%" | cannot_verify | medium | NUMERIC-CLAIM (check spec, not a KB item) |
   | AI | "We cut onboarding time by 60%" | contradicted | high | FACT-014, suggestion "Reduces onboarding time by up to 40%" |
   | AI | "guaranteed!" | violation | high | LEGAL-03 |
   | AI | whole sentence | violation (tone) | low | TONE-01 |
   All AI citations were shown as "Verified citation"; all three cited codes exist in the demo knowledge base. No AI findings were dropped.
4. **Accept:** Creator accepted the FACT-014 suggestion, which created v2 "Reduces onboarding time by up to 40%, guaranteed!", checked again automatically (6, 7).
5. **Edit:** Creator edited the critical "guaranteed" finding to "for many customers", which created v3 "Reduces onboarding time by up to 40%, for many customers!" (8, 9).
6. **Findings on v3:** automatic "40%" cannot_verify (medium); AI "Reduces onboarding time by up to 40%" **supported** by FACT-014.
7. **Dismiss:** Creator dismissed the "40%" finding with a reason (10, 11).
8. **Send for approval:** routed to the named Reviewer. Recorded reasons: "A finding concerns a claim or legal matter" and "A finding needs checking against approved sources". Check outcome: completed (12).
9. **Access checks while pending:**
   - Second reviewer (same workspace, not assigned): "Content not available".
   - Second creator (same workspace): "Content not available".
   - Creator in workspace B: "Content not available".
   - Admin in workspace B: "Access required".
   - Admin in workspace A: "Access required" (content is closed to Admins by design).
   - Manager: can see the item, but gets no decision panel (it was routed to a reviewer).
10. **Reviewer** found the item in the Review Queue (13, 14) and approved it with a comment (15).
11. **Final:** status Approved, v3. Version history v1 → v2 → v3 is kept, with the approval history and reasons visible to the Creator (16).

## Deviations and limitations
- The automatic check still marks "40%" as "needs checking" even after the AI confirmed it against FACT-014. This is expected: automatic checks never judge figures. It does mean the Creator needs a dismiss step.
- AI output can vary between runs. This record reflects one run.
- Reviewers see the Creator as "Workspace member" (privacy rule kept, Task 2).
- Admin-only knowledge base wording appears in the citations shown to the Creator and Reviewer. This is existing Phase 5 behaviour and was not changed here.

## Tests
Browser run: all steps passed, 0 failures, no console errors captured. No automated tests were changed in this task.

## Cleanup
9 temporary accounts and 9 workspaces removed. 0 remaining rows in contents, approvals, comments, finding actions and workspaces, and 0 temporary profiles. 0 demo-flagged rules, facts or glossary entries remain anywhere. The demo-data loader is unchanged.
