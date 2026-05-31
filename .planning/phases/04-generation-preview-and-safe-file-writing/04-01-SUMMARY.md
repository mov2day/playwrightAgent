---
phase: 04-generation-preview-and-safe-file-writing
plan: 01
subsystem: generation
tags: [playwright, generation, deterministic, marker-ids, file-placement]
requires:
  - phase: 03-planning-ux-and-approval-gates
    provides: approved/excluded/regeneration review snapshot contracts and orchestrator scope boundaries
provides:
  - Immutable approved-only generation workset builder with excluded audit fields
  - Deterministic marker ID utility and marker-bounded script block composer
  - Canonical spec placement planner with `patch_existing` and `create_scoped` modes
affects: [preview, writer, orchestrator, generation]
tech-stack:
  added: []
  patterns: [approved-scope projection, marker-bounded idempotent composition, functionality-grouped placement]
key-files:
  created:
    - src/pipeline/generation/generationContracts.ts
    - src/pipeline/generation/generationWorkset.ts
    - src/pipeline/generation/markerIds.ts
    - src/pipeline/generation/scriptComposer.ts
    - src/pipeline/generation/specPlacement.ts
    - tests/unit/generation-workset.test.ts
    - tests/unit/marker-ids.test.ts
    - tests/unit/spec-placement.test.ts
  modified:
    - src/pipeline/generation/generationWorkset.ts
key-decisions:
  - "Generation workset trusts orchestrator-approved IDs but still enforces `approvalState === 'approved'` from plan records to prevent stale scope leakage."
  - "Placement planner uses deterministic functionality slug mapping to `<functionality>.spec.ts` and upgrades to `patch_existing` when a matching spec already exists."
patterns-established:
  - "Approved-only workset filtering with deterministic locale sorting for scenario IDs."
  - "Stable marker wrappers (`@pwagent:begin/@pwagent:end`) for idempotent regenerate targeting."
requirements-completed: [GEN-01, GEN-02]
duration: 7min
completed: 2026-05-31
---

# Phase 04 Plan 01: Generation Workset and Placement Summary

**Approved-scope generation worksets with deterministic marker IDs and canonical spec placement policies for safe idempotent writes**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-31T07:17:18Z
- **Completed:** 2026-05-31T07:23:56Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added immutable generation contracts and workset builder constrained to approved scenario scope with excluded audit reporting.
- Added deterministic per-scenario marker IDs and marker-bounded script composition primitives.
- Added functionality-grouped spec placement planner with canonical writer-compatible modes and unit coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define approved-scope generation contracts and immutable workset builder**
   - `4699f7f` (`test`): failing RED coverage for workset scope, exclusion accounting, regeneration subset behavior.
   - `7692d91` (`feat`): generation contracts and deterministic approved-only workset implementation.
2. **Task 2: Implement marker-aware script composition and canonical spec placement policy**
   - `b031f73` (`test`): failing RED coverage for marker determinism and placement grouping/modes.
   - `64fddff` (`feat`): marker ID utility, marker-wrapped composer, and canonical placement planner.

## Files Created/Modified
- `src/pipeline/generation/generationContracts.ts` - Contracts for immutable generation workset projection.
- `src/pipeline/generation/generationWorkset.ts` - Approved-only deterministic workset builder with regeneration subset support.
- `src/pipeline/generation/markerIds.ts` - Deterministic `pwagent_*` marker ID generator.
- `src/pipeline/generation/scriptComposer.ts` - Marker-bounded test block composition with begin/end markers.
- `src/pipeline/generation/specPlacement.ts` - Functionality grouping and canonical `patch_existing` / `create_scoped` placement modes.
- `tests/unit/generation-workset.test.ts` - Workset scope, exclusion, and regeneration behavior tests.
- `tests/unit/marker-ids.test.ts` - Marker determinism and identity-change tests.
- `tests/unit/spec-placement.test.ts` - Functionality grouping and placement mode tests.

## Decisions Made
- Enforced dual filtering in workset construction: scenario must be in snapshot `approvedScenarioIds` and still be `approvalState === 'approved'`.
- Kept placement path deterministic by basing scoped file names on normalized functionality slugs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed strict-null guard in generation workset filtering**
- **Found during:** Plan-level verification (`npm run typecheck`)
- **Issue:** TypeScript flagged possible `undefined` access in approved-record filter predicate (`TS18048`).
- **Fix:** Added explicit `isApprovedRecord` guard with `record !== undefined` check.
- **Files modified:** `src/pipeline/generation/generationWorkset.ts`
- **Verification:** `npm run lint && npm run typecheck && npm run test -- tests/unit/generation-workset.test.ts tests/unit/marker-ids.test.ts tests/unit/spec-placement.test.ts`
- **Committed in:** `2856cb6`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Correction required for strict type safety; no scope creep and all plan criteria remain satisfied.

## Issues Encountered
- Initial typecheck failed on strict-null predicate narrowing in `generationWorkset.ts`; resolved via explicit type guard.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Generation stage now has deterministic approved-scope input contracts for preview/write stages.
- Placement and marker semantics are writer-compatible and ready for preview diff + surgical write implementation.

## Self-Check: PASSED
- All expected files for plan outputs exist on disk.
- All expected task/deviation commits are present in git history.

---
*Phase: 04-generation-preview-and-safe-file-writing*
*Completed: 2026-05-31*
