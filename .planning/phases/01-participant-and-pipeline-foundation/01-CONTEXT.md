# Phase 1: Participant and Pipeline Foundation - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the VS Code extension foundation for `@PlaywrightAgent`, including chat participant registration, `/plan` command entry (ticket and no-ticket), and deterministic pipeline request-state handling with gate-safe transitions. This phase does not implement deep Jira/Confluence fetch or full test generation logic yet.

</domain>

<decisions>
## Implementation Decisions

### Extension Structure
- **D-01:** Use layered `src/` module structure from day one (`participant/`, `pipeline/`, `adapters/`, `ui/`, shared contracts).
- **D-02:** Create typed central config + environment reader module (no ad-hoc env reads across modules).
- **D-03:** Add minimal webview shell now (route + placeholder panel), not full UI implementation.
- **D-04:** Define strict adapter interfaces now for local tooling boundaries (`JiraClient`, `ConfluenceClient`) with stub implementations.

### `/plan` Command Behavior
- **D-05:** Ticket token parsing is strict: `ABC-123` style tokens only. Non-matching first token is treated as free context unless explicit `--ticket` is used.
- **D-06:** `/plan` with no ticket starts guided follow-up prompt in chat immediately.
- **D-07:** Trailing text after ticket is captured as high-priority user context with source tag `user_input`.
- **D-08:** Invalid ticket format is soft-fail: warn user and offer continue in no-ticket mode.

### Pipeline State Model
- **D-09:** Use in-memory request state in phase 1 plus structured event-log sink interface.
- **D-10:** Enforce gate transitions with explicit finite-state machine and allowed-transition table.
- **D-11:** Generate `requestId` per `/plan` run and propagate through all stage events/log records.
- **D-12:** No resume in phase 1; restart behavior marks session interrupted and shows clear user notice.

### Phase 1 Test Scope
- **D-13:** Use Vitest as primary test framework for extension/service logic.
- **D-14:** Include lightweight integration tests for command parsing and state transition rules in phase 1.
- **D-15:** Webview testing in phase 1 is smoke-only (panel opens and renders stub payload).
- **D-16:** Phase 1 quality gate requires `lint + typecheck + unit + lightweight integration` before completion.

### the agent's Discretion
- Exact folder/file naming within the chosen layered structure.
- Internal shape of event payload objects, as long as they support `requestId` and gate traceability.
- Selection of lightweight helper utilities for test fixtures/mocks within Vitest.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and plan slots.
- `.planning/REQUIREMENTS.md` — `PART-01` to `PART-04` acceptance scope for this phase.
- `.planning/PROJECT.md` — project constraints, governance model, and security non-negotiables.

### Product Behavior Contract
- `docs/tool.md` — authoritative orchestration behavior and mandatory approval-gate expectations.
- `docs/playwright_agent_architecture.html` — pipeline stage model and gate sequence reference.

### Implementation Guidance and Repo Rules
- `AGENTS.md` — project-level execution guidance and standards for contributors/agents.
- `.planning/research/SUMMARY.md` — research-backed phase ordering rationale and risk flags.

### Existing Runtime Pattern References
- `skills/playwright-skill/run.js` — orchestration pattern for staged execution and error handling.
- `skills/playwright-skill/lib/helpers.js` — reusable helper design conventions and options-driven APIs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/playwright-skill/run.js`: existing orchestrator flow for input parsing, staged execution, and guarded failure handling.
- `skills/playwright-skill/lib/helpers.js`: reusable helper-module pattern with focused functions and options objects.
- `docs/tool.md`: detailed behavior contract already describes desired end-state orchestration steps and gate policy.

### Established Patterns
- Repository prefers modular docs + separate runtime helper modules rather than monolithic single files.
- Existing runtime code uses explicit guard clauses, try/catch boundaries, and structured status logging.
- Security posture already implies env-based secret handling and no hardcoded credentials.

### Integration Points
- New extension code will be introduced under a new `src/` tree while preserving existing `skills/` assets as references.
- Participant layer should bind directly to pipeline stage contracts and adapter interfaces defined in this phase.
- Local-tool adapters should be designed now, then connected to actual Jira/Confluence tooling in Phase 2.

</code_context>

<specifics>
## Specific Ideas

- Approval and preview gates must be impossible to bypass in normal flow.
- User-entered context must always have highest practical influence when ambiguity exists.
- Quick chat actions (`approve`, `reject`, `continue`, `cancel`) should be supported as first-class control events.
- Strict auditability: all AI interactions should be traceable through request-scoped logs.

</specifics>

<deferred>
## Deferred Ideas

- Full Material UI implementation details for tabbed review panel deferred to Phase 3.
- Persistent resume/recovery across restarts deferred to later phase after core state machine is stable.

</deferred>

---
*Phase: 01-participant-and-pipeline-foundation*
*Context gathered: 2026-05-30*
