---
phase: 05-execution-retry-loop-and-audit-logging
plan: 01
subsystem: testing
tags: [playwright, vitest, execution, reporting, classification]
requires:
  - phase: 04-generation-preview-and-safe-file-writing
    provides: generated/updated target set and write/approval workflow consumed by scoped execution
provides:
  - scoped Playwright run contracts with generated/updated default scope
  - explicit command preview payload before execution start
  - deterministic failure buckets and concise-first run summary formatter
affects: [participant, orchestrator, execution-retry-loop, audit-logging]
tech-stack:
  added: []
  patterns: [tdd-red-green, normalized-target-scope, preview-before-run-event, concise-plus-expandable-reporting]
key-files:
  created:
    - src/pipeline/execution/contracts.ts
    - src/pipeline/execution/scopedRunExecutor.ts
    - src/pipeline/execution/failureClassifier.ts
    - src/pipeline/execution/reportSummarizer.ts
    - tests/integration/execution-run-flow.test.ts
    - tests/integration/execution-classification-reporting.test.ts
  modified: []
key-decisions:
  - "Default execution scope is generated/updated targets only; full suite requires explicit full_suite_opt_in."
  - "Execution reporting separates concise pass/fail diagnostics from expandable raw stdout/stderr payloads."
patterns-established:
  - "Scoped execution contract normalization: dedupe + deterministic sort for generated/updated targets."
  - "Failure reporting contract: deterministic bucket classification with explicit bucketReason evidence."
requirements-completed: [RUN-01, RUN-02]
duration: 5min
completed: 2026-05-31
---

# Phase 05 Plan 01: Scoped Execution and Failure Reporting Summary

**Scoped Playwright run executor with generated/updated default targeting, explicit full-suite opt-in, and deterministic root-cause summary buckets with expandable raw output details.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-31T21:36:16Z
- **Completed:** 2026-05-31T21:41:23Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added execution contracts and `executeScopedRun(...)` service with fail-closed behavior when scoped targets are empty.
- Emitted deterministic `execution_command_preview` and `execution_run_started` sequencing with exact command/arg preview payload.
- Added deterministic failure classifier plus concise-first report summarizer with required bucket rationale and raw output expansion path.
- Added integration coverage for scoped execution flow and failure classification/report formatting behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scoped run contracts and executor with explicit command preview**
   - `8c9f4d8` (test, RED)
   - `b87c9d1` (feat, GREEN)
2. **Task 2: Implement deterministic failure buckets and concise-first run summary formatter**
   - `01f7f96` (test, RED)
   - `c31827d` (feat, GREEN)

## Files Created/Modified
- `src/pipeline/execution/contracts.ts` - Scoped run request/preview contracts with normalized generated/updated target derivation.
- `src/pipeline/execution/scopedRunExecutor.ts` - Command preview builder + scoped runner execution service and event emission.
- `src/pipeline/execution/failureClassifier.ts` - Deterministic mapping to `test_authoring`, `application_behavior`, `environment_or_tooling`.
- `src/pipeline/execution/reportSummarizer.ts` - Concise summary (`passCount`, `failCount`, `failingFiles`, `topErrors`) and expandable raw output payload.
- `tests/integration/execution-run-flow.test.ts` - Integration coverage for scope defaults, full-suite opt-in, and preview/start event ordering.
- `tests/integration/execution-classification-reporting.test.ts` - Integration coverage for bucket mapping and concise-plus-expandable report output.

## Decisions Made
- Kept scoped execution contract separate from orchestrator wiring to preserve deterministic command assembly and testability.
- Classified failures with ordered evidence matching (environment/tooling -> application -> test authoring) to enforce deterministic outcomes.
- Stored raw stdout/stderr only in expandable report section while keeping concise summary fields explicit and stable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Case-sensitive bucket reason assertion mismatch**
- **Found during:** Task 2 verification
- **Issue:** Integration test expected `bucketReason` to contain lowercase `locator`; classifier emitted capitalized sentence.
- **Fix:** Normalized classifier reason text to lowercase `locator` wording for deterministic assertion match.
- **Files modified:** `src/pipeline/execution/failureClassifier.ts`
- **Verification:** `npm run test -- tests/integration/execution-classification-reporting.test.ts`
- **Committed in:** `c31827d`

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** No scope creep; fix was required to satisfy deterministic reporting test contract.

## Authentication Gates

None.

## Issues Encountered
- Parallel `git add` produced transient `.git/index.lock`; resolved by retrying staging sequentially.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RUN-01 and RUN-02 building blocks are in place for orchestration wiring and retry/audit integration in subsequent plans.
- No blockers from this plan’s scoped files.

## Self-Check: PASSED
- Verified created files exist on disk.
- Verified task commit hashes exist in git history (`8c9f4d8`, `b87c9d1`, `01f7f96`, `c31827d`).

---
*Phase: 05-execution-retry-loop-and-audit-logging*
*Completed: 2026-05-31*
