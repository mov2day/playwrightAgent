# Phase 4: Generation, Preview, and Safe File Writing - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate Playwright tests only from approved scenarios, require explicit preview approval before any write, enforce append/surgical safe write policy, and run lint/type checks with one controlled auto-fix attempt before user escalation.

</domain>

<decisions>
## Implementation Decisions

### Generation Packaging
- **D-01:** Default generation mode is hybrid: append into an existing safe-matched spec; create a new scoped spec when safe match is not available.
- **D-02:** Approved scenarios that share the same functionality are grouped into the same spec file.
- **D-03:** New files use the naming pattern `<functionality>.spec.ts`.
- **D-04:** For matched files, generated tests are appended at the end of the relevant existing `describe` block.

### Preview Gate UX
- **D-05:** Preview must be shown in both chat and webview.
- **D-06:** File writes are unblocked only by one explicit global approve-all decision for the generated change set.
- **D-07:** Preview payload includes structured summary plus patch diff (not summary-only and not raw-patch-only).
- **D-08:** Any preview comment that changes generated content triggers targeted regeneration and mandatory fresh re-approval.

### Safe Write Rules
- **D-09:** If anchor detection is unsafe/absent in a target file, that file is not modified; write falls back to a new scoped file.
- **D-10:** Generated blocks use stable per-scenario marker IDs so regenerate/write cycles update or replace the same block instead of duplicating tests.
- **D-11:** Mixed outcomes are allowed: write safe files, skip blocked files, and emit explicit skipped-file reporting.
- **D-12:** Write engine runs in strict no-delete mode for existing user-authored tests/blocks.

### Lint/Type Auto-fix Escalation
- **D-13:** The one allowed auto-fix retry may edit only generated/updated test files in scope.
- **D-14:** If retry fails, escalation must show a structured failure bundle: command, top errors, affected files, attempted fix summary, and suggested actions.
- **D-15:** Escalation actions keep phase-consistent gate vocabulary (`approve`, `reject`, `continue`, `cancel`) and free-text comments.
- **D-16:** Execution is blocked when lint/type still fails after retry until user decision is captured.

### Skill Bundle Governance
- **D-17:** Skill bundling uses a strict allowlist for `skills/playwright-skill` guidance assets; forbidden artifacts (`.git/*`, `.DS_Store`, temp/runtime leftovers) are excluded.
- **D-18:** Skill bundle load/validation is mandatory before planning, test generation, preview preparation, and write stages; stage fails closed if bundle validation is unavailable.
- **D-19:** Skill quality gate includes schema/frontmatter checks, linked-file integrity, artifact hygiene checks, and deterministic manifest hash generation.
- **D-20:** Skill quality-gate failures block stage progression and require explicit user decision; no silent degraded fallback.

### the agent's Discretion
- Exact manifest format/hash algorithm and cache invalidation policy for skill bundle checks.
- Exact UI wording/layout details for preview and escalation messages while preserving locked gate semantics.
- Internal stage hook boundaries as long as mandatory pre-stage skill loading is enforced.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Requirement Contracts
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, and plan slots (`04-01` to `04-03`).
- `.planning/REQUIREMENTS.md` — `GEN-01..GEN-06` acceptance requirements that this phase must satisfy.
- `.planning/PROJECT.md` — governance constraints (approval gates, security boundaries, write safety expectations).

### Product and Pipeline Behavior
- `docs/tool.md` — authoritative end-to-end behavior contract for approval-gated planning/generation/write flow.
- `docs/playwright_agent_architecture.html` — pipeline stages/gates and UI review interactions.

### Prior Locked Decisions (Phase 3 Dependency)
- `.planning/phases/03-planning-ux-and-approval-gates/03-CONTEXT.md` — approved-scope, revision, and action-sync decisions carried into generation/write behavior.
- `.planning/phases/03-planning-ux-and-approval-gates/03-03-SUMMARY.md` — implemented orchestrator approval state and scope selector outcomes.

### Current Implementation Anchors
- `src/pipeline/orchestrator.ts` — authoritative review snapshot (`approvedScenarioIds`, exclusion + regeneration state).
- `src/pipeline/planning/approvalScope.ts` — approved-scope and targeted regeneration selectors.
- `src/participant/handler.ts` — chat action/free-text ingestion and plan payload construction.
- `src/ui/reviewActions.ts` — normalized action envelope contracts used for gate transitions.
- `src/ui/planReviewShell.ts` — current review-shell integration surface for preview-stage rendering alignment.

### Skill Bundle Inputs (Mandatory for Phase 4 Governance)
- `skills/playwright-skill/SKILL.md` — primary skill orchestrator contract.
- `skills/playwright-skill/PAGE_OBJECT_MODEL_SKILL.md` — POM implementation guidance.
- `skills/playwright-skill/SCREENPLAY_PATTERN_SKILL.md` — Screenplay implementation guidance.
- `skills/playwright-skill/HELPER_FUNCTIONS_SKILL.md` — reusable helper/data utility guidance.
- `skills/playwright-skill/API_REFERENCE.md` — extended Playwright skill references.
- `skills/playwright-skill/lib/helpers.js` — runtime helper implementation baseline for reuse constraints.
- `skills/playwright-skill/run.js` — execution wrapper behavior baseline.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pipeline/orchestrator.ts`: already computes authoritative approved/excluded scenario scope and captures review history.
- `src/pipeline/planning/approvalScope.ts`: deterministic selectors for approved scope and regeneration target calculation.
- `src/participant/handler.ts`: request-scoped context and free-text classification flow already wired.
- `src/ui/reviewActions.ts` + `src/ui/planReviewShell.ts`: stable action and review payload contracts that preview-stage UX can reuse.
- `skills/playwright-skill/*.md`: domain guidance corpus that can be bundled/validated as pre-stage skill context.

### Established Patterns
- Request-scoped state and event propagation are mandatory across participant → gate → orchestrator flow.
- Transition legality is centrally enforced by finite-state machine guards.
- Contracts are typed and tested via Vitest unit/integration coverage.
- Safety semantics already favor explicit allowlists and fail-closed gate transitions.

### Integration Points
- Generation stage should consume orchestrator-approved scenario IDs directly from session snapshot boundaries.
- Preview stage should reuse existing chat + webview message/action paths instead of introducing parallel state channels.
- Write stage must integrate no-delete, marker-ID replacement, and safe-anchor fallback policies.
- Skill bundle quality gate should execute as a pre-stage dependency before planning/generation/preview/write entry.

</code_context>

<specifics>
## Specific Ideas

- Skills in `skills/` are mandatory bundle inputs and must be quality-checked/loaded before planning, generation, preview preparation, and write.
- Preview should remain reviewer-first: quick summary in chat plus richer diff scanning in webview.
- Write safety is correctness-first, even if that means partial writes and explicit skipped-file output.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---
*Phase: 04-generation-preview-and-safe-file-writing*
*Context gathered: 2026-05-31*
