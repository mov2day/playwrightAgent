---
phase: 05-execution-retry-loop-and-audit-logging
reviewed: 2026-06-01T07:34:39Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/adapters/auditFileSink.ts
  - src/adapters/eventSink.ts
  - src/participant/handler.ts
  - src/pipeline/events.ts
  - src/pipeline/execution/contracts.ts
  - src/pipeline/execution/failureClassifier.ts
  - src/pipeline/execution/reportSummarizer.ts
  - src/pipeline/execution/scopedRunExecutor.ts
  - src/pipeline/orchestrator.ts
  - src/pipeline/stateMachine.ts
  - tests/integration/audit-persistence-request-correlation.test.ts
  - tests/integration/audit-redaction-persistence.test.ts
  - tests/integration/execution-classification-reporting.test.ts
  - tests/integration/execution-retry-escalation.test.ts
  - tests/integration/execution-run-flow.test.ts
  - tests/integration/request-correlation.test.ts
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-01T07:34:39Z  
**Depth:** standard  
**Files Reviewed:** 16  
**Status:** issues

## Summary

Reviewed all Phase 05 source and integration-test changes from plan summaries and commit diffs. The execution/audit architecture is coherent and tests pass, but there is one high-severity execution-scope security issue and two behavior risks that can cause unexpected run scope and escalation behavior.  

Verification performed:
- `npm run test -- tests/integration/execution-run-flow.test.ts tests/integration/execution-classification-reporting.test.ts tests/integration/execution-retry-escalation.test.ts tests/integration/request-correlation.test.ts tests/integration/audit-redaction-persistence.test.ts tests/integration/audit-persistence-request-correlation.test.ts`
- `npm run typecheck`
- `npm run lint`

## Critical Issues

### CR-01: Scoped Test Targets Allow CLI Option Injection

**File:** `src/pipeline/execution/scopedRunExecutor.ts:60-66`  
**Issue:** Scoped target paths are appended directly to Playwright args with no guard. A target beginning with `-`/`--` is interpreted as a CLI flag instead of a file path, allowing scope/behavior tampering (for example `--config=...`, `--grep=...`) and violating the intended generated/updated-only boundary.

**Fix:**
```ts
function assertSafeTargetArg(target: string): string {
  const normalized = target.trim();
  if (!normalized || normalized.startsWith('-')) {
    throw new Error(`Unsafe scoped target argument: ${target}`);
  }
  return normalized;
}

function buildScopedRunArgs(request: ScopedRunRequest): string[] {
  const args = ['playwright', 'test'];
  if (request.scopeMode !== 'full_suite_opt_in') {
    const safeTargets = request.targets.map(assertSafeTargetArg);
    args.push('--', ...safeTargets);
  }
  args.push('--reporter=json');
  return args;
}
```

## Warnings

### WR-01: Explicit Target Inputs Can Be Widened by Stale Session Fallback

**File:** `src/pipeline/orchestrator.ts:1197-1203`  
**Issue:** `executeScopedRun(...)` always falls back `generatedOrUpdatedTargets` to `session.lastGeneratedOrUpdatedTargets` when `options.generatedOrUpdatedTargets` is missing, even if `generatedTargets`/`updatedTargets` are explicitly supplied. Because `createScopedRunRequest(...)` merges all target arrays, stale targets from prior runs can be silently included.

**Fix:**
```ts
const hasExplicitTargets =
  (options.generatedOrUpdatedTargets?.length ?? 0) > 0 ||
  (options.generatedTargets?.length ?? 0) > 0 ||
  (options.updatedTargets?.length ?? 0) > 0;

const runRequest = createScopedRunRequest({
  requestId,
  scopeMode: options.scopeMode,
  generatedTargets: options.generatedTargets,
  updatedTargets: options.updatedTargets,
  generatedOrUpdatedTargets: hasExplicitTargets
    ? options.generatedOrUpdatedTargets
    : session.lastGeneratedOrUpdatedTargets
});
```
Add integration coverage for explicit `generatedTargets`/`updatedTargets` with non-empty `lastGeneratedOrUpdatedTargets`.

### WR-02: Empty Scoped Target Set Enters Retry/Escalation Loop Instead of Immediate Non-Actionable Fail-Close

**File:** `src/pipeline/orchestrator.ts:1220-1239`  
**Issue:** Empty-target fail-close from the executor (`No generated/updated targets...`) is treated as generic guardrail failure and sent through one-shot auto-fix + escalation. This can move session state to `awaiting_guardrail_decision` with empty actionable scope instead of returning a direct "no targets available" outcome.

**Fix:**
```ts
const initialRun = await runExecutor();

if (
  initialRun.scopeMode !== 'full_suite_opt_in' &&
  initialRun.targets.length === 0 &&
  initialRun.result.error?.includes('No generated/updated targets')
) {
  this.emit(requestId, 'orchestrator', 'execution_run_no_targets', session.state, {
    scopeMode: initialRun.scopeMode
  }, session.confidenceProfileId, session.decisionGate);

  return {
    ok: false,
    requestId,
    from: session.state,
    to: session.state,
    errorCode: 'EXECUTION_RUN_FAILED',
    run: initialRun
  };
}
```
Add an integration test that calls `orchestrator.executeScopedRun(...)` with empty scoped targets and asserts no escalation state transition.

---

_Reviewed: 2026-06-01T07:34:39Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
