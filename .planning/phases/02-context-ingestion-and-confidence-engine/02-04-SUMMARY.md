---
phase: 02-context-ingestion-and-confidence-engine
plan: 04
subsystem: api
tags: [playwright, confidence, gating, explainability, audit]
requires:
  - phase: 02-context-ingestion-and-confidence-engine
    provides: repo analyzer, Jira context ingestion, and Confluence relevance signals
provides:
  - Deterministic profile-based confidence engine with fixed threshold gates
  - Sanitized confidence explainability payload and audit-ready event metadata
  - Participant/orchestrator confidence gate integration with Continue/Cancel + free-text recompute
affects: [plan-gating, user-approval-flow, audit-logging]
tech-stack:
  added: []
  patterns: [profile-versioned-confidence, threshold-gate-enforcement, free-text-recompute-loop]
key-files:
  created:
    - src/pipeline/confidence/confidenceContracts.ts
    - src/pipeline/confidence/confidenceEngine.ts
    - src/pipeline/confidence/explainability.ts
    - tests/unit/confidence-engine.test.ts
    - tests/integration/confidence-gate-flow.test.ts
  modified:
    - src/adapters/eventSink.ts
    - src/pipeline/events.ts
    - src/pipeline/orchestrator.ts
    - src/participant/handler.ts
key-decisions:
  - "Confidence gate policy is enforced exactly as fixed: `<40 reject`, `40-70 approval_required`, `>70 continue`."
  - "Approval-required gate exposes only `continue` and `cancel` quick actions and always supports free-text context."
  - "Confidence explainability evidence is sanitized before user/audit emission, including token/secret/header-like content."
patterns-established:
  - "Pattern 1: Confidence decisions carry profile ID/version + gate value for deterministic replay and auditing."
  - "Pattern 2: Free-text follow-ups append context and trigger explicit confidence recomputation rather than bypassing gates."
requirements-completed: [CONF-03, CONF-04, CONF-05, CONF-06]
duration: 14 min
completed: 2026-05-30
---

# Phase 2 Plan 04: Confidence Gate Summary

**Profile-versioned confidence engine and gate orchestration that deterministically enforces thresholds, emits sanitized explanations, and supports user-controlled Continue/Cancel with free-text recomputation.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-05-30T16:02:00+02:00
- **Completed:** 2026-05-30T16:16:00+02:00
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Added confidence contracts and deterministic computation with fixed threshold routing.
- Added explainability builder with sensitive evidence sanitization and event payload confidence metadata (`confidenceProfileId`, `decisionGate`).
- Integrated confidence gate behavior into handler/orchestrator, including approval-required action constraints and free-text-driven recompute.

## Task Commits

1. **Task 1: Define confidence contracts, weight profiles, and deterministic scoring engine** - `33fae13` (feat)
2. **Task 2: Implement explainability and sanitized evidence payload generation** - `024b22c` (feat)
3. **Task 3: Wire gate decision to participant/orchestrator with required actions and free-text loop support** - `df0eacc` (feat)

## Files Created/Modified
- `src/pipeline/confidence/confidenceContracts.ts` - Confidence score, profile, threshold, and decision contracts.
- `src/pipeline/confidence/confidenceEngine.ts` - Deterministic score computation and fixed gate routing.
- `src/pipeline/confidence/explainability.ts` - Explainability payload and evidence sanitization.
- `src/adapters/eventSink.ts` - Event payload support for confidence profile and gate metadata.
- `src/pipeline/events.ts` - Pipeline event construction extended with confidence fields.
- `src/pipeline/orchestrator.ts` - Session-level confidence decision tracking, free-text append support, and mapped continue behavior.
- `src/participant/handler.ts` - Confidence computation stage integration, gate response payloads, and `handleGateFreeText` recompute path.
- `tests/unit/confidence-engine.test.ts` - Threshold boundary, sanitization, and event payload coverage.
- `tests/integration/confidence-gate-flow.test.ts` - Reject/approval/continue branch coverage with free-text recomputation.
- `tests/integration/no-ticket-flow.test.ts`, `tests/integration/request-correlation.test.ts` - Updated assertions for confidence-stage events and mapped actions.

## Decisions Made
- Confidence is computed at command handling time so orchestration state always reflects an explicit gate decision.
- Free-text support is implemented as context append + recompute, not direct transition, preserving gate integrity.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Existing integration assertions expected pre-confidence event counts and action mappings; updated tests to reflect confidence-stage behavior while preserving request-correlation guarantees.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Confidence gate contracts and runtime wiring are ready for Phase 3 planning UX integration.
- Explainability and audit metadata now provide stable inputs for gate transparency surfaces.

## Self-Check: PASSED

- Verification rerun passed: `npm run lint`, `npm run typecheck`, `npm run test -- tests/unit/confidence-engine.test.ts`, `npm run test:integration -- tests/integration/confidence-gate-flow.test.ts`.
- Acceptance checks satisfied: boundary values validated, required gate action payloads present, named integration cases pass.

---
*Phase: 02-context-ingestion-and-confidence-engine*
*Completed: 2026-05-30*
