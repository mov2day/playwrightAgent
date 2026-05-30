# Phase 3: Planning UX and Approval Gates - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver requirement-mapped plan output and approval-first review surfaces in chat and VS Code webview, including per-scenario and bulk approval/rejection controls, synchronization between chat and webview decisions, and revision loops driven by quick actions plus free-text feedback. This phase defines planning and approval UX/state behavior only; script generation and file writes remain in later phases.

</domain>

<decisions>
## Implementation Decisions

### Plan Data Contract
- **D-01:** Each scenario stores one `primaryRequirementId` plus `acceptanceCriteriaIds[]` for mixed granular and grouped coverage views.
- **D-02:** Risk is represented as `riskLevel` (`low|medium|high`) plus `riskReason` and optional `mitigation`.
- **D-03:** Assertion intent is stored as a narrative summary field (not structured assertion objects in this phase).
- **D-04:** Persist both a flat scenario list and precomputed group indexes (requirement/AC/functionality) for fast tab/group rendering.

### Webview UX Model and Visual Direction
- **D-05:** Webview tabs must include `All`, requirement/AC group views, and `Rejected`.
- **D-06:** UX must support per-scenario approve/reject controls plus a sticky bulk-action bar for approve-all/reject-all flows.
- **D-07:** Comments exist at two levels: per-scenario comment and global run comment.
- **D-08:** Implement review UI as React + MUI inside VS Code webview.
- **D-09:** Design system direction is fixed to hybrid style: minimalist base + high-end accents + Emil motion discipline + anti-slop frontend guardrails.

### Approval State Synchronization (Chat and Webview)
- **D-10:** Pipeline orchestrator session store is single source of truth; chat and webview dispatch actions and consume synced state.
- **D-11:** Scenario-level approval state uses `pending|approved|rejected|needs_revision` plus `revisionReason[]` tracking.
- **D-12:** Bulk actions affect `pending` items only by default; explicit per-item decisions are preserved unless a force override is chosen.
- **D-13:** Use optimistic UI updates with immediate event sync and orchestrator acknowledgement reconciliation.

### Revision Loop and Regeneration Policy
- **D-14:** Rejecting a scenario marks it `needs_revision`, preserves history, and excludes it from approved generation scope until re-approved.
- **D-15:** Free-text comments are classified as `clarification|constraint|bug|new_context` and attached to `scenario` or `global` targets.
- **D-16:** Revision trigger is targeted regeneration only for impacted scenarios (no full-plan regenerate by default).
- **D-17:** Keep quick actions `approve|reject|continue|cancel` and add explicit `revise` CTA in webview revision UX.

### the agent's Discretion
- Final TypeScript type naming and file/module boundaries for scenario plan contracts.
- Exact MUI component composition (tab variants, list virtualization strategy, layout breakpoints) while preserving locked behavior.
- Event payload granularity for sync telemetry, as long as orchestrator remains source of truth.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Requirements
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and plan slots (`03-01` to `03-03`).
- `.planning/REQUIREMENTS.md` — Requirement IDs `PLAN-01..PLAN-06` and `RUN-04..RUN-05` for this phase.
- `.planning/PROJECT.md` — governance, security boundaries, and user-priority constraints.

### Product Contracts
- `docs/tool.md` — end-state behavior contract for approval gates, comments, and stage progression.
- `docs/playwright_agent_architecture.html` — pipeline stage/gate sequence and UI interaction model reference.

### Existing Implementation Anchors
- `src/participant/handler.ts` — current `/plan` response shape, confidence-gate actions, free-text handling.
- `src/pipeline/orchestrator.ts` — request/session state store and quick-action transition wiring.
- `src/pipeline/stateMachine.ts` — legal transition graph and gate-state progression rules.
- `src/ui/planReviewShell.ts` — current webview shell stub to evolve into full review panel.
- `src/participant/actions.ts` — canonical quick-action vocabulary.
- `tests/integration/confidence-gate-flow.test.ts` — confidence-gate behavior and free-text recompute pattern.
- `tests/integration/request-correlation.test.ts` — request-scoped transition/event correlation expectations.
- `tests/smoke/webview-shell.test.ts` — baseline shell rendering expectations.

### External Local Design Skill References
- `../../../.agents/skills/emil-design-eng/SKILL.md` — interaction/motion craftsmanship and polish heuristics.
- `../../../.agents/skills/design-taste-frontend/SKILL.md` — anti-slop design direction and architecture defaults.
- `../../../.agents/skills/high-end-visual-design/SKILL.md` — premium visual hierarchy, materiality, and choreography patterns.
- `../../../.agents/skills/minimalist-ui/SKILL.md` — minimalist editorial baseline and restrained visual system constraints.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ui/planReviewShell.ts`: existing review shell entry point and payload bridge for webview rendering.
- `src/pipeline/orchestrator.ts`: action dispatch and state transition engine ready for scenario-level extension.
- `src/participant/handler.ts`: free-text intake and gate response scaffolding reusable for revision comments.
- `tests/smoke/webview-shell.test.ts`: smoke-test pattern for webview output continuity.

### Established Patterns
- Request-scoped `requestId` propagation across participant/parser/bootstrap/gate stages is mandatory.
- State transitions are strictly controlled by finite-state rules; illegal transitions are explicitly rejected and logged.
- Quick actions are normalized to `approve|reject|continue|cancel` and already integrated through orchestrator.

### Integration Points
- Extend orchestrator session model with scenario-level approval objects and revision metadata.
- Replace `PlanReviewShellPayload.summary`-only shape with typed scenario/group contract while keeping request/state/action anchors.
- Bind chat quick-action events and webview interactions to same orchestrator dispatch path for deterministic sync.

</code_context>

<specifics>
## Specific Ideas

- Approval UX must support both granular scenario decisions and bulk workflow speed without desynchronization.
- Revision handling should preserve audit trail; rejected scenarios become `needs_revision` and re-enter gate only after targeted update.
- Visual execution should feel professional and intentional: minimalist backbone with selective premium accents and disciplined motion.
- Free-text is first-class input at gates and must be preserved with semantic classification for regeneration decisions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---
*Phase: 03-planning-ux-and-approval-gates*
*Context gathered: 2026-05-30*
