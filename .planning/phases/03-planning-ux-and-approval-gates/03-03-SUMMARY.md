---
phase: 03-planning-ux-and-approval-gates
plan: 03
subsystem: orchestration
tags: [orchestrator, approval, revision, scope]
requires:
  - phase: 03-01
    provides: scenario plan records with requirement traceability
  - phase: 03-02
    provides: normalized review action envelopes and webview controls
provides:
  - Scenario-level approval lifecycle in orchestrator as single source of truth
  - Classified free-text revision routing from chat into review mutation path
  - Deterministic approved scope and targeted regeneration selectors
affects: [phase-04-approved-generation, phase-05-audit-logging]
tech-stack:
  added: []
  patterns: [single-writer orchestrator review state, ack-versioned optimistic reconciliation]
key-files:
  created:
    - src/pipeline/planning/approvalScope.ts
    - tests/unit/approval-scope.test.ts
    - tests/integration/approval-sync-flow.test.ts
    - tests/integration/free-text-revision-flow.test.ts
  modified:
    - src/pipeline/stateMachine.ts
    - src/pipeline/orchestrator.ts
    - src/participant/handler.ts
    - src/ui/reviewActions.ts
    - tests/integration/request-correlation.test.ts
key-decisions:
  - "Scenario reject paths map to needs_revision and preserve revision reasons for targeted regeneration."
  - "Global and scenario comments both feed scope selectors through one orchestrator-owned snapshot."
patterns-established:
  - "Approved scope selector allows only approved scenarios for downstream generation."
  - "Comment-driven regeneration target selection avoids full replan by default."
requirements-completed: [PLAN-04, PLAN-05, PLAN-06, RUN-04, RUN-05]
duration: 60min
completed: 2026-05-31
---

# Phase 3: Planning UX and Approval Gates Summary

**Chat and webview actions now mutate one orchestrator-owned approval state, with deterministic approved-scope filtering and targeted revision regeneration.**

## Performance

- **Duration:** 60 min
- **Started:** 2026-05-31T02:00:00Z
- **Completed:** 2026-05-31T03:00:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Extended orchestrator sessions with scenario review records, revision history, global comments, and ack versions.
- Implemented `applyScenarioAction` for per-scenario, bulk, comment, and session actions with guarded pending-only semantics.
- Added approved scope and regeneration selectors and wired free-text classification from chat into revision flow.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend orchestrator/state model for scenario lifecycle** - pending phase commit
2. **Task 2: Wire quick actions and free-text into synchronized revision loop** - pending phase commit
3. **Task 3: Enforce approved scope and targeted regeneration selectors** - pending phase commit

**Plan metadata:** pending phase commit

## Files Created/Modified
- `src/pipeline/orchestrator.ts` - Added scenario-level review authority and snapshot generation.
- `src/pipeline/stateMachine.ts` - Added revision gate state path.
- `src/participant/handler.ts` - Free-text classification and orchestrator comment dispatch.
- `src/pipeline/planning/approvalScope.ts` - Approved scope and regeneration target selectors.
- `tests/unit/approval-scope.test.ts` - Scope exclusion and targeted regeneration assertions.
- `tests/integration/approval-sync-flow.test.ts` - Cross-surface sync and bulk pending-only semantics.
- `tests/integration/free-text-revision-flow.test.ts` - Classification and regeneration signal path verification.
- `tests/integration/request-correlation.test.ts` - Request-level event correlation includes review action mutation.

## Decisions Made
- Chose orchestrator as the only mutable review state authority; UI/chat become action emitters plus snapshot consumers.
- Treated `scenario.reject` and relevant comment classifications as `needs_revision` instead of destructive delete semantics.

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 can consume `approvedScenarioIds` directly for generation boundaries.
- Regeneration targeting now identifies impacted scenarios/requirements from revision feedback.

---
*Phase: 03-planning-ux-and-approval-gates*
*Completed: 2026-05-31*
