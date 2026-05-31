# Phase 5: Execution, Retry Loop, and Audit Logging - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Close loop with execution outcomes, controlled remediation, and full auditability for generated Playwright tests. Scope includes run orchestration, one-shot repair control, and persistent redacted audit records. It does not add new planning/generation capabilities.

</domain>

<decisions>
## Implementation Decisions

### Run Trigger and Scope
- **D-01:** Default run scope is only generated/updated test targets from current request, not full suite.
- **D-02:** Run step is user-triggered from workflow after write/preview completion and reports scoped command before execution.
- **D-03:** Full-suite execution remains explicit opt-in (out of default phase-5 path).

### Failure Reporting Model
- **D-04:** Failure output is grouped into root-cause buckets: `test_authoring`, `application_behavior`, and `environment_or_tooling`.
- **D-05:** Chat summary stays concise first (pass/fail counts, failing files, top errors) with expandable raw stderr/stdout details.
- **D-06:** Every run report must include enough signal to distinguish likely test issue vs app issue (RUN-02).

### One-Shot Repair Boundary
- **D-07:** Keep prior locked rule from Phase 4 D-13: one retry max, and auto-edits restricted to generated/updated test files in current scope.
- **D-08:** No fixture/helper/refactor edits in auto-fix retry path; broader edits require explicit user direction after escalation.
- **D-09:** Retry failure must return structured escalation bundle and block progression until a user decision is captured.

### Audit Logging Persistence and Redaction
- **D-10:** Use dual sink: runtime in-memory sink for live UX plus persistent file sink for audit durability.
- **D-11:** Persist per-request structured audit files under `.planning/logs/audit/` keyed by `requestId`.
- **D-12:** Apply redaction before persistence using existing local-tool redaction rules, and store deterministic redaction evidence metadata for traceability.
- **D-13:** Persist all AI interactions and gate decisions with request correlation fields (SECU-03, SECU-04).

### Gate Behavior After Failed Retry
- **D-14:** `continue` means user confirms manual fix completed, then workflow reruns the same scoped tests.
- **D-15:** `reject` or `cancel` terminates current execution flow.
- **D-16:** `approve` accepts current state and closes gate with explicit recorded acknowledgment.

### the agent's Discretion
- Exact audit file schema versioning, log rotation policy, and formatter shape, as long as redaction and traceability constraints above are preserved.
- Exact phrasing/ordering of report sections in chat and webview, while preserving required diagnostic fields.

</decisions>

<specifics>
## Specific Ideas

- Use recommended defaults for all identified gray areas in this phase.
- Keep gate vocabulary and governance strictness consistent with prior phases.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements
- `.planning/ROADMAP.md` — Phase 5 goal, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` — RUN-01, RUN-02, RUN-03, SECU-03, SECU-04 traceability targets.
- `.planning/PROJECT.md` — core governance and security constraints for enterprise workflow.

### Prior Locked Decisions
- `.planning/phases/04-generation-preview-and-safe-file-writing/04-CONTEXT.md` — carry-forward constraints D-13..D-16 used by phase-5 execution semantics.

### Existing Runtime Contracts
- `src/adapters/localToolRunner.ts` — command execution and redaction baseline used for run/audit output handling.
- `src/adapters/eventSink.ts` — event sink interface and in-memory sink baseline.
- `src/pipeline/events.ts` — canonical pipeline event shape with `requestId` correlation.
- `src/pipeline/orchestrator.ts` — existing gate/transition model, guardrail escalation, and decision history integration points.

### Product Contract Reference
- `docs/tool.md` — participant orchestration contract for plan/gate/generate/write/run lifecycle expectations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runLocalToolCommand` + `redactSensitiveText` (`src/adapters/localToolRunner.ts`) provide command execution, timeout handling, and redaction primitives for run/audit paths.
- `EventSink` / `InMemoryEventSink` (`src/adapters/eventSink.ts`) provide current event abstraction for extending to persistent audit sink.
- `PipelineOrchestrator` (`src/pipeline/orchestrator.ts`) already tracks request-scoped state, retry escalation, and gate actions; phase-5 run loop should plug here.
- `createPipelineEvent` (`src/pipeline/events.ts`) provides shared event schema for structured audit records.

### Established Patterns
- Request-scoped `requestId` propagation across participant, pipeline, UI, and tests is already mandatory.
- Gate actions are constrained to `approve|reject|continue|cancel` and enforced through orchestrator transitions.
- Fail-closed behavior and structured escalation bundles are existing governance patterns.

### Integration Points
- Run executor should integrate with orchestrator after write completion/approval path.
- Repair loop should reuse existing guardrail escalation and decision capture semantics.
- Audit persistence should subscribe to or mirror emitted pipeline events without breaking current in-memory behavior.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---
*Phase: 05-execution-retry-loop-and-audit-logging*
*Context gathered: 2026-05-31*
