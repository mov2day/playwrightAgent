---
phase: 02-context-ingestion-and-confidence-engine
plan: 02
subsystem: api
tags: [playwright, jira, traversal, context-ingestion, security]
requires:
  - phase: 01-participant-and-pipeline-foundation
    provides: typed pipeline orchestration and request-scoped lifecycle controls
provides:
  - Local-tool-only Jira adapter contract with redaction-safe failures
  - Bounded Jira graph traversal with mandatory task/subtask/epic traversal rules
  - Jira context builder with retry/backoff budgets and explicit completeness reasons
affects: [context-ingestion, confluence-querying, confidence-engine]
tech-stack:
  added: []
  patterns: [local-tool-adapter-boundary, bounded-graph-expansion, completeness-reason-codes]
key-files:
  created:
    - src/adapters/localToolRunner.ts
    - src/adapters/jiraClient.ts
    - src/adapters/jiraGraphTraversal.ts
    - src/adapters/jiraAttachmentPolicy.ts
    - src/pipeline/context/jiraContextBuilder.ts
  modified:
    - tests/unit/jira-client.test.ts
    - tests/unit/jira-graph-traversal.test.ts
key-decisions:
  - "Keep Jira credentials process-local by routing all fetches through local tooling wrappers only."
  - "Use global visited sets + hard caps to enforce deterministic graph expansion and prevent cycle blowups."
  - "Expose explicit completeness reason codes (`timeout`, `cap_reached`, `attachment_skipped`) instead of silent degradation."
patterns-established:
  - "Pattern 1: Local adapter contract surfaces typed payloads and redacted, timeout-aware failures."
  - "Pattern 2: Context builders must emit bounded metrics and completeness semantics for downstream scoring."
requirements-completed: [JIRA-01, JIRA-02, JIRA-03, JIRA-04, JIRA-05, JIRA-06]
duration: 12 min
completed: 2026-05-30
---

# Phase 2 Plan 02: Jira Context Ingestion Summary

**Secure, bounded Jira deep-fetch ingestion with deterministic traversal semantics and explicit completeness metadata for confidence gating.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-30T15:48:00+02:00
- **Completed:** 2026-05-30T16:00:00+02:00
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added a local-tool Jira adapter contract and implementation that prevents credential leakage in error paths.
- Implemented deep traversal with global dedupe, provenance edges, hard caps, and mandatory task/sub-task/epic relationship handling.
- Built Jira context normalization with stage budgets, retry/backoff, attachment allowlist/size policy, and partial completeness reasons.

## Task Commits

1. **Task 1: Create local tooling runner and Jira client contract** - `55b41f6` (feat)
2. **Task 2: Implement deep traversal policy with global dedupe and mandatory ticket-type rules** - `e71f562` (feat)
3. **Task 3: Add attachment policy, stage budgets, and completeness semantics** - `05feb94` (feat)

## Files Created/Modified
- `src/adapters/localToolRunner.ts` - Safe subprocess wrapper with timeout and output redaction.
- `src/adapters/jiraClient.ts` - Typed Jira client contract and local-tool implementation.
- `src/adapters/jiraGraphTraversal.ts` - Graph traversal engine with caps, visited sets, and provenance edges.
- `src/adapters/jiraAttachmentPolicy.ts` - Attachment allowlist and size-cap extraction policy.
- `src/pipeline/context/jiraContextBuilder.ts` - Bounded Jira context assembler with retry/backoff and completeness metadata.
- `tests/unit/jira-client.test.ts` - Coverage for redaction safety, normalization, and timeout-safe error surfacing.
- `tests/unit/jira-graph-traversal.test.ts` - Coverage for mandatory traversal rules and partial completeness on cap/timeout.

## Decisions Made
- Applied retry/backoff in the context builder rather than in downstream scoring to keep ingestion deterministic and auditable.
- Encoded cap and timeout behavior as explicit reason codes so gates can explain why context is partial.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Strict typecheck flagged a mock client return as possibly `undefined`; resolved by adding a typed fallback payload in tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Jira ingestion contracts now provide bounded, typed context ready for Confluence query synthesis and confidence scoring (`02-03`).
- Completeness and truncation signals are available for gate explainability decisions.

## Self-Check: PASSED

- Verification rerun passed: `npm run lint`, `npm run typecheck`, `npm run test -- tests/unit/jira-client.test.ts`, `npm run test -- tests/unit/jira-graph-traversal.test.ts`.
- Acceptance checks satisfied: mandatory test names present, global visited sets and `truncated` flags implemented, completeness reason codes emitted.

---
*Phase: 02-context-ingestion-and-confidence-engine*
*Completed: 2026-05-30*
