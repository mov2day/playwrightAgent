# Phase 5: Execution, Retry Loop, and Audit Logging - Research

**Researched:** 2026-05-31  
**Domain:** Playwright execution orchestration, one-shot remediation control, and redacted audit persistence  
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Default run scope is only generated/updated test targets from current request, not full suite.
- **D-02:** Run step is user-triggered from workflow after write/preview completion and reports scoped command before execution.
- **D-03:** Full-suite execution remains explicit opt-in (out of default phase-5 path).
- **D-04:** Failure output is grouped into root-cause buckets: `test_authoring`, `application_behavior`, and `environment_or_tooling`.
- **D-05:** Chat summary stays concise first (pass/fail counts, failing files, top errors) with expandable raw stderr/stdout details.
- **D-06:** Every run report must include enough signal to distinguish likely test issue vs app issue (RUN-02).
- **D-07:** Keep prior locked rule from Phase 4 D-13: one retry max, and auto-edits restricted to generated/updated test files in current scope.
- **D-08:** No fixture/helper/refactor edits in auto-fix retry path; broader edits require explicit user direction after escalation.
- **D-09:** Retry failure must return structured escalation bundle and block progression until a user decision is captured.
- **D-10:** Use dual sink: runtime in-memory sink for live UX plus persistent file sink for audit durability.
- **D-11:** Persist per-request structured audit files under `.planning/logs/audit/` keyed by `requestId`.
- **D-12:** Apply redaction before persistence using existing local-tool redaction rules, and store deterministic redaction evidence metadata for traceability.
- **D-13:** Persist all AI interactions and gate decisions with request correlation fields (SECU-03, SECU-04).
- **D-14:** `continue` means user confirms manual fix completed, then workflow reruns the same scoped tests.
- **D-15:** `reject` or `cancel` terminates current execution flow.
- **D-16:** `approve` accepts current state and closes gate with explicit recorded acknowledgment.

### Claude's Discretion
- Exact audit file schema versioning, log rotation policy, and formatter shape, as long as redaction and traceability constraints above are preserved.
- Exact phrasing/ordering of report sections in chat and webview, while preserving required diagnostic fields.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | User can trigger run of newly created/updated Playwright tests from workflow. | Scoped run executor pattern with explicit user-triggered command preview and file-scoped Playwright CLI invocation. [VERIFIED: .planning/REQUIREMENTS.md, .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md] [CITED: https://playwright.dev/docs/test-cli] |
| RUN-02 | Agent reports pass/fail results with enough detail to distinguish likely test vs app failures. | Structured result ingestion from Playwright reporter/JSON output plus deterministic bucket classifier (`test_authoring`, `application_behavior`, `environment_or_tooling`). [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md] [CITED: https://playwright.dev/docs/test-reporters] [CITED: https://playwright.dev/docs/api/class-testresult] |
| RUN-03 | On failures, agent attempts one controlled fix cycle and then asks user for next action if unresolved. | Reuse existing one-shot retry/escalation contract and guardrail decision flow (`awaiting_guardrail_decision`, `approve/reject/continue/cancel`). [VERIFIED: src/pipeline/guardrails/retryEscalation.ts, src/pipeline/orchestrator.ts, tests/integration/lint-type-escalation-flow.test.ts] |
| SECU-03 | Agent logs all AI interactions and gate decisions for audit review. | Extend `EventSink` dual-sink model: keep in-memory UX stream and add persistent request-scoped audit sink keyed by `requestId`. [VERIFIED: src/adapters/eventSink.ts, src/pipeline/events.ts, src/pipeline/orchestrator.ts, .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md] |
| SECU-04 | Logs redact sensitive data before persistence. | Reuse existing `redactSensitiveText` before writing audit records; attach redaction evidence metadata per event. [VERIFIED: src/adapters/localToolRunner.ts, src/adapters/jiraClient.ts, src/adapters/confluenceClient.ts, tests/unit/jira-client.test.ts] |
</phase_requirements>

## Summary

Phase 5 should extend existing pipeline contracts, not introduce a parallel workflow: request correlation, gate transitions, and one-shot retry escalation already exist and are tested in orchestrator/guardrail code. [VERIFIED: src/pipeline/orchestrator.ts, src/pipeline/events.ts, src/pipeline/guardrails/retryEscalation.ts, tests/integration/lint-type-escalation-flow.test.ts]

Execution/reporting should be built on Playwright structured outputs (JSON reporter or Reporter API), not fragile stderr-only parsing, because reporter surfaces machine-readable test status/error/stdout/stderr and supports scoped invocation via CLI file filters and test lists. [CITED: https://playwright.dev/docs/test-reporters] [CITED: https://playwright.dev/docs/api/class-testresult] [CITED: https://playwright.dev/docs/test-cli]

Auditability target is dual sink with redaction-before-persist: keep `InMemoryEventSink` for live UI behavior and add append-only, request-scoped persistent sink at `.planning/logs/audit/<requestId>.ndjson`, redacting with existing regex layer and recording deterministic redaction evidence per record. [VERIFIED: src/adapters/eventSink.ts, src/adapters/localToolRunner.ts, .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md] [CITED: https://nodejs.org/api/fs.html]

**Primary recommendation:** Implement Phase 5 as `run -> classify -> optional one-shot fix -> rerun -> escalate` around existing orchestrator state/gate contracts, with a new persistent redacted audit sink fed by the same canonical pipeline events. [VERIFIED: src/pipeline/orchestrator.ts, src/pipeline/events.ts, .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trigger scoped Playwright run after approved write | API / Backend (VS Code extension host pipeline) | Browser / Client | Quick actions and state transitions are already orchestrator-owned; UI only issues actions. [VERIFIED: src/participant/handler.ts, src/pipeline/orchestrator.ts] |
| Execute shell command with timeout and capture stdio | API / Backend | — | Process execution and timeout/redaction abstractions already live in Node adapter layer. [VERIFIED: src/adapters/localToolRunner.ts] [CITED: https://nodejs.org/api/child_process.html] |
| Classify failures into required buckets | API / Backend | — | Classification must consume structured run output and feed gate decisions before UI rendering. [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md] |
| One-shot remediation and escalation gate | API / Backend | Browser / Client | Retry limits and decision allowlist already enforced in orchestrator state machine; UI captures explicit user decision only. [VERIFIED: src/pipeline/orchestrator.ts, src/pipeline/stateMachine.ts, tests/integration/lint-type-escalation-flow.test.ts] |
| Live interaction stream for chat/webview | Browser / Client | API / Backend | In-memory sink remains UX transport for immediate summaries and gate hints. [VERIFIED: src/adapters/eventSink.ts, src/participant/handler.ts] |
| Durable redacted audit persistence | Database / Storage (filesystem) | API / Backend | Per-request structured files under `.planning/logs/audit/` are explicit locked decision and durability boundary. [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md, .planning/logs missing] |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | `1.60.0` (published `2026-05-11T19:09:45.394Z`) | Execute scoped tests and expose structured result model. | Official runner supports scoped file execution, retries, and reporter outputs needed for RUN-01/RUN-02. [VERIFIED: npm registry (`npm view @playwright/test version`, `npm view @playwright/test "time[1.60.0]"`, 2026-05-31)] [CITED: https://playwright.dev/docs/test-cli] [CITED: https://playwright.dev/docs/test-reporters] |
| `node:child_process` | Node runtime API (local Node `v22.17.0`) | Spawn Playwright command with controlled stdio/timeout/signal. | Existing local adapter already built on `spawn`; API supports timeout via `AbortSignal` pattern. [VERIFIED: src/adapters/localToolRunner.ts, `node --version` output] [CITED: https://nodejs.org/api/child_process.html] |
| `node:fs` / `node:fs/promises` | Node runtime API (local Node `v22.17.0`) | Append-only audit persistence keyed by `requestId`. | Node file API supports append semantics appropriate for NDJSON audit streams. [VERIFIED: `node --version` output] [CITED: https://nodejs.org/api/fs.html] |
| Existing `PipelineEvent` contract | In-repo | Canonical event envelope with request correlation. | Prevents schema drift between live UX and persisted audit sinks. [VERIFIED: src/pipeline/events.ts, src/pipeline/orchestrator.ts, src/adapters/eventSink.ts] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pino` | `10.3.1` (published `2026-02-09T15:50:56.728Z`) | Structured JSON logging + built-in redaction paths. | Use if Phase 5 chooses logger-backed sink instead of manual JSON serialization. [VERIFIED: npm registry (`npm view pino version`, `npm view pino "time[10.3.1]"`, 2026-05-31)] [CITED: https://github.com/pinojs/pino/blob/main/docs/api.md] |
| `vitest` | project-pinned `2.1.9` (latest registry `4.1.7`) | Fast integration/unit verification for new execution/audit code. | Keep existing phase test workflow stable; no forced test framework migration in this phase. [VERIFIED: package.json, `npx --no-install vitest --version`, npm registry (`npm view vitest version`, 2026-05-31)] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright structured reporters/JSON | Parse plain stderr/stdout text only | Raw text parsing is brittle and loses typed fields (`status`, `errors`, `stdout`, `stderr`) needed for RUN-02 classification. [CITED: https://playwright.dev/docs/api/class-testresult] |
| Filesystem NDJSON audit sink | SQLite audit DB | SQLite improves queryability but adds migration/locking complexity beyond Phase 5 scope and locked path decision. [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md] [ASSUMED] |
| Existing one-shot retry gate contract | Unlimited automatic repair loop | Violates locked one-retry governance and increases unsafe churn risk. [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md, src/pipeline/guardrails/retryEscalation.ts] |

**Installation:**
```bash
npm install -D @playwright/test@1.60.0
npm install pino@10.3.1
```

**Version verification:**
```bash
npm view @playwright/test version
npm view @playwright/test "time[1.60.0]"
npm view pino version
npm view pino "time[10.3.1]"
npm view vitest version
npm view zod version
```
[VERIFIED: npm registry commands executed 2026-05-31]

## Architecture Patterns

### System Architecture Diagram

```text
User quick action ("run")
  -> Participant handler validates requestId + state
  -> Orchestrator enters execution stage (fail-closed checks)
  -> Scoped run builder selects generated/updated test targets (D-01)
  -> Local runner executes `npx playwright test <scoped targets> --reporter=json`
  -> Result parser/classifier maps failures to:
       - test_authoring
       - application_behavior
       - environment_or_tooling
  -> If pass: emit summary + persist redacted audit events -> completed
  -> If fail: run one scoped auto-fix attempt (generated/updated files only)
       -> rerun scoped tests once
       -> if still failing: emit escalation bundle + transition to awaiting_guardrail_decision
  -> User decision (approve/reject/continue/cancel)
       -> approve: close with acknowledged failure
       -> continue: rerun same scoped tests
       -> reject/cancel: terminate flow

Every event in flow -> EventSink fan-out:
  1) InMemoryEventSink (live chat/webview UX)
  2) PersistentAuditSink (.planning/logs/audit/<requestId>.ndjson, redacted)
```
[VERIFIED: src/pipeline/orchestrator.ts, src/adapters/eventSink.ts, src/adapters/localToolRunner.ts, .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md] [CITED: https://playwright.dev/docs/test-cli] [CITED: https://playwright.dev/docs/test-reporters]

### Recommended Project Structure
```text
src/
├── pipeline/execution/            # run scope selection, command assembly, result classification
├── pipeline/execution/contracts.ts # RUN-01/02/03 typed contracts
├── adapters/auditFileSink.ts       # persistent redacted file sink implementation
├── adapters/eventSink.ts           # sink composition (in-memory + file sink)
├── pipeline/audit/                 # redaction evidence metadata + schema versioning
└── participant/                    # run trigger + escalation messaging integration
tests/
├── integration/execution-run-flow.test.ts
├── integration/execution-retry-escalation.test.ts
└── integration/audit-persistence-redaction.test.ts
```
[VERIFIED: existing structure in `src/` and `tests/`] [ASSUMED]

### Pattern 1: Scoped Execution Contract (Default Path)
**What:** Build execution command from current request's generated/updated targets only; never full suite unless explicit opt-in. [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md]  
**When to use:** All default Phase 5 runs (RUN-01). [VERIFIED: .planning/REQUIREMENTS.md]  
**Example:**
```typescript
// Source: https://playwright.dev/docs/test-cli
const args = ['playwright', 'test', ...scopedFiles, '--reporter=json'];
const result = await runLocalToolCommand('npx', args, 120_000);
```
[VERIFIED: src/adapters/localToolRunner.ts] [CITED: https://playwright.dev/docs/test-cli]

### Pattern 2: One-Shot Retry With Escalation Gate
**What:** Reuse existing `maxAttempts = 1` retry contract and enforce action allowlist after unresolved retry. [VERIFIED: src/pipeline/guardrails/retryEscalation.ts, src/pipeline/orchestrator.ts]  
**When to use:** Any failed post-run remediation in current request scope (RUN-03). [VERIFIED: .planning/REQUIREMENTS.md]  
**Example:**
```typescript
// Source: in-repo contract
const outcome = await resolveLintTypeRetryEscalation({
  requestId,
  initialGuardrailResult,
  targetFiles: scopedFiles,
  maxAttempts: 1,
  applyScopedAutoFix,
  rerunGuardrail
});
```
[VERIFIED: src/pipeline/guardrails/retryEscalation.ts]

### Pattern 3: Dual-Sink Event Emission for Auditability
**What:** Emit canonical `PipelineEvent` once, fan out to in-memory and persistent sinks. [VERIFIED: src/adapters/eventSink.ts, src/pipeline/events.ts]  
**When to use:** Every AI interaction, gate decision, run command, run result, retry decision (SECU-03). [VERIFIED: .planning/REQUIREMENTS.md, .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md]  
**Example:**
```typescript
// Source: in-repo event contract + Node fs append semantics
const event = createPipelineEvent({ requestId, stage: 'gate', action: 'run_completed', details });
memorySink.emit(event);
await auditFileSink.emit(event); // internally redacts + appendFile
```
[VERIFIED: src/pipeline/events.ts, src/adapters/eventSink.ts] [CITED: https://nodejs.org/api/fs.html]

### Anti-Patterns to Avoid
- **Raw stderr-only diagnosis:** loses structured status and makes RUN-02 bucketing noisy; use reporter JSON/model fields first. [CITED: https://playwright.dev/docs/api/class-testresult]
- **Retry loop beyond one attempt:** violates locked governance and existing retry contract. [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md, src/pipeline/guardrails/retryEscalation.ts]
- **Persist-then-redact:** can leak secrets into durable logs; redaction must happen before persistence write call. [VERIFIED: src/adapters/localToolRunner.ts, tests/unit/jira-client.test.ts]
- **Gate bypass on unresolved failure:** escalation state must block until explicit user decision. [VERIFIED: src/pipeline/stateMachine.ts, src/pipeline/orchestrator.ts, tests/integration/lint-type-escalation-flow.test.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Playwright failure parsing | Custom regex parser over terminal text | Playwright JSON/custom reporter fields (`status`, `errors`, `stdout`, `stderr`) | Structured output is stable and machine-readable; text format is presentation-oriented and brittle. [CITED: https://playwright.dev/docs/test-reporters] [CITED: https://playwright.dev/docs/api/class-testresult] |
| Retry governance | New ad-hoc retry FSM | Existing `resolveLintTypeRetryEscalation` + orchestrator guardrail decision state | Existing code already enforces one-shot retries and explicit decision actions. [VERIFIED: src/pipeline/guardrails/retryEscalation.ts, src/pipeline/orchestrator.ts] |
| Event correlation schema | New per-feature log shape | Existing `createPipelineEvent` envelope with `requestId` | Keeps audit/events/query tooling consistent and avoids schema drift. [VERIFIED: src/pipeline/events.ts, tests/integration/request-correlation.test.ts] |
| Redaction rules | New regex set detached from adapters | Existing `redactSensitiveText` and shared adapter usage | Shared redaction logic already tested against token-like leaks. [VERIFIED: src/adapters/localToolRunner.ts, src/adapters/jiraClient.ts, src/adapters/confluenceClient.ts, tests/unit/jira-client.test.ts] |

**Key insight:** Phase 5 risk is orchestration drift, not missing primitives; highest-leverage path is composing existing contracts with Playwright structured output and a persistent sink. [VERIFIED: src/pipeline/orchestrator.ts, src/adapters/localToolRunner.ts, src/adapters/eventSink.ts] [CITED: https://playwright.dev/docs/test-reporters]

## Common Pitfalls

### Pitfall 1: Scope Creep Into Full Suite
**What goes wrong:** Default run executes full test suite, producing unrelated failures and user confusion. [VERIFIED: locked D-01/D-03 in .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md]  
**Why it happens:** Command builder ignores request-scoped target set and uses broad runner defaults. [ASSUMED]  
**How to avoid:** Require explicit scoped file list in execution contract; full suite only with opt-in action. [VERIFIED: locked D-01/D-03]  
**Warning signs:** Run report contains failures from files absent in current generation workset. [ASSUMED]

### Pitfall 2: Misclassifying App Failures as Test Authoring
**What goes wrong:** Retry auto-fix churns generated tests when underlying app or environment is broken. [VERIFIED: RUN-02/RUN-03 requirements]  
**Why it happens:** Classifier only reads exit code and ignores structured error context. [ASSUMED]  
**How to avoid:** Classify from structured result fields + command failures + known environment signatures first. [CITED: https://playwright.dev/docs/api/class-testresult] [VERIFIED: src/adapters/localToolRunner.ts]  
**Warning signs:** Auto-fix edits tests but rerun still fails with same infrastructure-level error. [VERIFIED: tests/integration/lint-type-escalation-flow.test.ts]

### Pitfall 3: Audit Log Secret Leakage
**What goes wrong:** Tokens/headers leak into persistent files. [VERIFIED: SECU-04 requirement]  
**Why it happens:** Redaction applied inconsistently across code paths or after write. [ASSUMED]  
**How to avoid:** Single redaction function in sink path + persisted redaction evidence metadata per record. [VERIFIED: src/adapters/localToolRunner.ts, locked D-12]  
**Warning signs:** Audit file contains `Bearer`/`authorization=` literals beyond redacted placeholders. [VERIFIED: redaction patterns in src/adapters/localToolRunner.ts]

### Pitfall 4: Non-Blocking Escalation State
**What goes wrong:** Pipeline continues despite unresolved retry failure. [VERIFIED: RUN-03 requirement and state machine contracts]  
**Why it happens:** Transition guard does not enforce `awaiting_guardrail_decision`. [ASSUMED]  
**How to avoid:** Keep `awaiting_guardrail_decision` as hard gate with allowlisted actions only. [VERIFIED: src/pipeline/stateMachine.ts, src/pipeline/orchestrator.ts]  
**Warning signs:** `retry` or unknown quick actions mutate state from blocked stage. [VERIFIED: tests/integration/lint-type-escalation-flow.test.ts]

## Code Examples

Verified patterns from official sources:

### Scoped Playwright CLI Invocation
```typescript
// Source: https://playwright.dev/docs/test-cli
const args = ['playwright', 'test', ...scopedFiles, '--reporter=json', '--workers=1'];
const run = await runLocalToolCommand('npx', args, 120_000);
```
[CITED: https://playwright.dev/docs/test-cli] [VERIFIED: src/adapters/localToolRunner.ts]

### Custom Reporter Hook Surface
```typescript
// Source: https://playwright.dev/docs/test-reporters
class AuditReporter {
  onTestEnd(test, result) {
    // capture status/errors/stdout/stderr for classifier + audit event
  }
  onEnd(result) {
    // emit run summary event
  }
}
export default AuditReporter;
```
[CITED: https://playwright.dev/docs/test-reporters] [CITED: https://playwright.dev/docs/api/class-testresult]

### Append-Only Audit Persistence
```typescript
// Source: https://nodejs.org/api/fs.html
import { appendFile } from 'node:fs/promises';

await appendFile(auditPath, `${JSON.stringify(redactedEvent)}\n`, 'utf8');
```
[CITED: https://nodejs.org/api/fs.html]

### Pino Redaction Config (If Logger Sink Chosen)
```typescript
// Source: https://github.com/pinojs/pino/blob/main/docs/api.md
const logger = pino({
  redact: {
    paths: ['req.headers.authorization', '*.token', '*.secret'],
    censor: '[REDACTED]'
  }
});
```
[CITED: https://github.com/pinojs/pino/blob/main/docs/api.md]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse human-readable reporter text for diagnostics | Consume Playwright structured reporter/JSON outputs | Ongoing best practice in current Playwright docs (verified 2026-05-31) | Better deterministic classification and stable machine parsing. [CITED: https://playwright.dev/docs/test-reporters] [CITED: https://playwright.dev/docs/api/class-testresult] |
| Retry many times or rely on serial mode for stability | Keep retries explicit/scoped and bounded; avoid serial as default crutch | Playwright docs explicitly discourage serial for general use | Prevents masking flaky root causes and governance bypass. [CITED: https://playwright.dev/docs/test-parallel] [CITED: https://playwright.dev/docs/test-retries] |
| In-memory-only event history | Dual sink (in-memory + durable redacted file) | Required by Phase 5 locked decisions | Adds forensic auditability and request reconstruction. [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md, src/adapters/eventSink.ts] |

**Deprecated/outdated:**
- `stderr`-only run diagnosis as primary source: obsolete for this phase goals; use structured result fields first. [CITED: https://playwright.dev/docs/api/class-testresult]
- Unlimited autonomous fix loops: conflicts with locked governance and existing max-attempt contract. [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md, src/pipeline/guardrails/retryEscalation.ts]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SQLite may be unnecessary overhead vs NDJSON for current audit durability scope. | Standard Stack / Alternatives | Could under-spec future query needs and force later migration. |
| A2 | Recommended folder additions under `src/pipeline/execution` and `src/pipeline/audit` fit project architecture direction. | Architecture Patterns | Planner may choose different module boundaries and require remapping. |
| A3 | Scope-creep root cause is command builder defaults widening scope to full-suite execution. | Common Pitfalls / Pitfall 1 | Mitigation may miss actual trigger if widening happens earlier in flow. |
| A4 | Full-suite drift warning sign is failures from files outside current generation workset. | Common Pitfalls / Pitfall 1 | Detection heuristics may under-report drift. |
| A5 | Misclassification root cause is over-reliance on exit code without structured result context. | Common Pitfalls / Pitfall 2 | Classifier quality work could target wrong failure signals. |
| A6 | Redaction leakage root cause is inconsistent or post-write sanitization. | Common Pitfalls / Pitfall 3 | Mitigation may not address actual leakage path. |
| A7 | Escalation bypass root cause is missing transition guard for blocked state. | Common Pitfalls / Pitfall 4 | Guard hardening may focus wrong module. |
| A8 | Audit retention policy resolved to `retentionDays=14`, `maxFileBytes=5_000_000`, and rotate-on-threshold with cleanup automation deferred to Phase 6. | Open Questions (RESOLVED) / Q1 | Operations policy may evolve in later phases based on audit volume. |
| A9 | Classifier precedence resolved to deterministic ordered rules with contract tests: `environment_or_tooling` -> `application_behavior` -> `test_authoring`. | Open Questions (RESOLVED) / Q2 | Signature set may need extension as failure corpus grows. |
| A10 | Execution root resolved as explicit execution contract field (`executionCwd`) validated before launch. | Open Questions (RESOLVED) / Q3 | If workspace metadata is missing, run must fail closed with install/root guidance. |

## Open Questions (RESOLVED)

1. **Audit retention and rotation policy — RESOLVED**
   - **Decision:** Phase 5 uses explicit bounded defaults in code: `retentionDays=14`, `maxFileBytes=5_000_000`, and rotate-audit-file guard on append threshold. Cleanup automation is scheduled for Phase 6, but Phase 5 persistence is bounded immediately. [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md]
   - **Planning impact:** Encoded in `05-03-PLAN.md` Task 1 action/acceptance criteria.

2. **Classifier rule source of truth — RESOLVED**
   - **Decision:** Classifier uses deterministic precedence rules with explicit `bucketReason` output: first match `environment_or_tooling`, else `application_behavior`, else `test_authoring` fallback. Mixed-signal failures resolve by precedence order, not nondeterministic heuristics. [VERIFIED: .planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md]
   - **Planning impact:** Encoded in `05-01-PLAN.md` Task 2 behavior/acceptance criteria and contract-test requirement.

3. **Execution environment target root — RESOLVED**
   - **Decision:** Execution contract must carry `executionCwd` and validate it before launch; default is workspace-under-test root from request context (not extension host root). If Playwright runtime is unavailable in that root, run fails closed with actionable install/root guidance. [VERIFIED: `npm ls @playwright/test --depth=0`, `npx --no-install playwright --version` outputs]
   - **Planning impact:** Encoded in `05-01-PLAN.md` Task 1 contract/executor work and scoped command preview flow.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | local execution adapters, audit sink IO | ✓ | `v22.17.0` | — |
| npm | script/test tooling | ✓ | `10.9.2` | — |
| npx | Playwright command launch path | ✓ | `10.9.2` | — |
| Playwright CLI (local machine context) | RUN-01 command execution path | ✓ | `1.40.0` | Use workspace-local Playwright binary if present; otherwise block with actionable install guidance. |
| Vitest | Phase verification tests | ✓ | `2.1.9` | — |
| TypeScript CLI | typecheck guardrails | ✓ | `5.9.3` | — |
| ESLint CLI | lint guardrails | ✓ | `9.39.4` | — |

[VERIFIED: `node --version`, `npm --version`, `npx --version`, `npx --no-install playwright --version`, `npx --no-install vitest --version`, `npx --no-install tsc --version`, `npx --no-install eslint --version` outputs on 2026-05-31]

**Missing dependencies with no fallback:**
- Root workspace package `@playwright/test` is not installed in this repository context; if execution root remains this repo, RUN-01 is blocked until installed. [VERIFIED: `npm ls @playwright/test --depth=0`]

**Missing dependencies with fallback:**
- None in current local toolchain snapshot. [VERIFIED: command outputs above]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `2.1.9` in repo (`latest registry: 4.1.7`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test -- tests/integration/lint-type-escalation-flow.test.ts` |
| Full suite command | `npm run test` |

[VERIFIED: package.json, vitest.config.ts, command outputs]

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01 | Trigger scoped run for generated/updated targets only | integration | `npm run test -- tests/integration/execution-run-flow.test.ts` | ❌ Wave 0 |
| RUN-02 | Classify failures into `test_authoring` / `application_behavior` / `environment_or_tooling` with concise summary + raw details | integration | `npm run test -- tests/integration/execution-classification-reporting.test.ts` | ❌ Wave 0 |
| RUN-03 | One retry max, then escalation gate requiring explicit action | integration | `npm run test -- tests/integration/execution-retry-escalation.test.ts` | ❌ Wave 0 |
| SECU-03 | Persist all AI interactions + gate decisions with request correlation | integration | `npm run test -- tests/integration/audit-persistence-request-correlation.test.ts` | ❌ Wave 0 |
| SECU-04 | Redact sensitive data before persistence with evidence metadata | integration/unit | `npm run test -- tests/integration/audit-redaction-persistence.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/integration/lint-type-escalation-flow.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/integration/execution-run-flow.test.ts` - covers RUN-01 scoped execution contract.
- [ ] `tests/integration/execution-classification-reporting.test.ts` - covers RUN-02 bucketed diagnostics.
- [ ] `tests/integration/execution-retry-escalation.test.ts` - covers RUN-03 one-shot retry + decision gate.
- [ ] `tests/integration/audit-persistence-request-correlation.test.ts` - covers SECU-03 persistence completeness.
- [ ] `tests/integration/audit-redaction-persistence.test.ts` - covers SECU-04 redaction-before-persist.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A for this phase scope (no auth mechanism introduced). [VERIFIED: .planning/ROADMAP.md phase 5 scope] |
| V3 Session Management | no | N/A for this phase scope. [VERIFIED: .planning/ROADMAP.md phase 5 scope] |
| V4 Access Control | yes | Gate-action allowlist + explicit transition guards (`approve/reject/continue/cancel`) before state mutation. [VERIFIED: src/pipeline/orchestrator.ts, src/pipeline/stateMachine.ts] |
| V5 Input Validation | yes | Validate action payloads + sanitize/redact persisted output paths/content before write. [VERIFIED: src/participant/handler.ts, src/adapters/localToolRunner.ts] |
| V6 Cryptography | yes (limited) | Use Node built-in crypto primitives only (`createHash`); do not add custom crypto in execution/audit path. [VERIFIED: src/pipeline/generation/markerIds.ts, src/pipeline/skills/manifestBuilder.ts] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret leakage in logs (Bearer/API keys/tokens) | Information Disclosure | Mandatory pre-persist redaction with shared sanitization function and audit evidence metadata. [VERIFIED: src/adapters/localToolRunner.ts, tests/unit/jira-client.test.ts] |
| Command injection via run command assembly | Tampering / Elevation | Avoid shell interpolation; pass command/args arrays to `spawn` and restrict command templates. [VERIFIED: src/adapters/localToolRunner.ts] [CITED: https://nodejs.org/api/child_process.html] |
| Gate bypass after failed retry | Elevation | Block in `awaiting_guardrail_decision` until allowlisted action captured. [VERIFIED: src/pipeline/stateMachine.ts, src/pipeline/orchestrator.ts] |
| Audit record forgery/missing correlation | Repudiation | Persist immutable request-correlated event envelopes (`requestId`, timestamp, stage, action). [VERIFIED: src/pipeline/events.ts, src/adapters/eventSink.ts] |

## Sources

### Primary (HIGH confidence)
- Local repository contracts and tests:
  - `src/pipeline/orchestrator.ts`
  - `src/pipeline/guardrails/retryEscalation.ts`
  - `src/pipeline/guardrails/lintTypeRunner.ts`
  - `src/adapters/localToolRunner.ts`
  - `src/adapters/eventSink.ts`
  - `src/pipeline/events.ts`
  - `src/participant/handler.ts`
  - `tests/integration/lint-type-escalation-flow.test.ts`
  - `tests/integration/request-correlation.test.ts`
  - `.planning/REQUIREMENTS.md`
  - `.planning/ROADMAP.md`
  - `.planning/phases/05-execution-retry-loop-and-audit-logging/05-CONTEXT.md`
- npm registry checks executed 2026-05-31:
  - `npm view @playwright/test version`
  - `npm view @playwright/test "time[1.60.0]"`
  - `npm view pino version`
  - `npm view pino "time[10.3.1]"`
  - `npm view vitest version`
  - `npm view vitest "time[4.1.7]"`
  - `npm view zod version`
  - `npm view zod "time[4.4.3]"`
- Official documentation:
  - https://playwright.dev/docs/test-cli
  - https://playwright.dev/docs/test-reporters
  - https://playwright.dev/docs/api/class-testresult
  - https://playwright.dev/docs/test-retries
  - https://playwright.dev/docs/test-parallel
  - https://nodejs.org/api/child_process.html
  - https://nodejs.org/api/fs.html
  - https://github.com/pinojs/pino/blob/main/docs/api.md
  - https://code.visualstudio.com/api/references/vscode-api#OutputChannel

### Secondary (MEDIUM confidence)
- OWASP ASVS reference taxonomy:
  - https://owasp.org/www-project-application-security-verification-standard/

### Tertiary (LOW confidence)
- None beyond explicit assumptions table.

## Metadata

**Confidence breakdown:**
- Standard stack: **MEDIUM** - core contracts and docs are strong, but execution root/tooling versioning across target repos is not fully locked yet.
- Architecture: **HIGH** - orchestrator/state/guardrail/event contracts already implemented and test-covered.
- Pitfalls: **MEDIUM** - major risks are clear from current code and requirements, but classifier rule quality depends on future failure corpus.

**Research date:** 2026-05-31  
**Valid until:** 2026-06-30 (30 days; fast-moving package versions should be rechecked at planning time)
