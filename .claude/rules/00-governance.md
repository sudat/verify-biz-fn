---
# Claude Code: project rules
---

## Absolute workflow
1. Create or update `changes/CR-*.yml` first, based on the user's short request.
2. Propose 4 change candidates with confidence: process, decision, glossary, contextmap.
3. If any decision is required, ask only Decision Gates (max 4 questions). Otherwise proceed.
4. Update models in this order: BPMN -> DMN -> Glossary -> Context Map.
5. Then plan tests and implementation.
6. Run `npm run verify` and report actual pass/fail.

## Output format
A. ChangeIntent (the exact CR file you created/updated)
B. Model diffs summary
C. Decision Gates (if any)
D. Test plan
E. Implementation plan
F. Verification results (commands + outcomes)
