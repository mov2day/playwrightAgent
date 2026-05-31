---
phase: 04-generation-preview-and-safe-file-writing
plan: 03
subsystem: preview
tags: [preview, unified-diff, webview, sanitization, tdd]
requires:
  - phase: 04-generation-preview-and-safe-file-writing
    provides: approved generation workset + stage-entry quality gates from 04-01 and 04-02
provides:
  - Canonical preview bundle assembly that emits one structured summary + unified patch payload for chat and webview
  - Deterministic per-file patch preview model rendering with request-scoped metadata
  - Script-preview shell output with sanitized summary/patch content and explicit approve-all gate CTA
affects: [generation, preview, write-gate, participant, webview]
tech-stack:
  added: []
  patterns: [single-source preview bundle assembly, deterministic file-diff ordering, render-path sanitization with token redaction]
key-files:
  created:
    - src/pipeline/preview/previewContracts.ts
    - src/pipeline/preview/diffBuilder.ts
    - src/pipeline/preview/previewAssembler.ts
    - src/ui/previewModel.ts
    - src/ui/previewShell.ts
    - src/pipeline/preview/diff.d.ts
    - tests/unit/preview-contracts.test.ts
    - tests/smoke/preview-shell.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/ui/reviewApp.tsx
key-decisions:
  - "Preview assembly is centralized in `previewAssembler` so chat and webview consume one canonical `PreviewBundle`."
  - "Webview preview rendering sanitizes patch/summary text and preserves Bearer-token redaction before HTML serialization."
patterns-established:
  - "Unified-diff presentation uses deterministic path sorting and shared previewVersion metadata to keep reviewer views aligned."
  - "Preview shell HTML always ships with serialized canonical model (`#preview-model`) and explicit `Approve All Changes` gate copy."
requirements-completed: [GEN-03]
duration: 13min
completed: 2026-05-31
---

# Phase 04 Plan 03: Canonical Preview Payload and Dual-Surface Rendering Summary

**Canonical preview assembly now delivers one deterministic summary+patch payload to both chat and webview, with sanitized diff rendering and explicit approve-all write-gate UX**

## Performance

- **Duration:** 13 min
- **Started:** 2026-05-31T08:05:34Z
- **Completed:** 2026-05-31T08:18:56Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Completed preview DTO contracts requiring structured `summary` and `fileDiffs[].unifiedPatch` in one payload and validated with unit RED/GREEN tests.
- Added deterministic diff generation and canonical preview assembler that emits one request-scoped bundle for chat summary and webview preview model.
- Implemented preview shell rendering with structured summary, per-file unified patch cards, approve-all CTA copy, and sanitization/redaction on preview content.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define canonical preview DTO contracts and deterministic unified diff builder**
   - `4e14a93` (`test`): failing RED tests for summary+patch contract completeness and deterministic diff ordering.
   - `e13e157` (`feat`): preview contracts, deterministic `diff` builder, and dependency wiring.
2. **Task 2: Assemble one preview bundle and render it in chat + webview**
   - `bf2f8d1` (`test`): failing RED smoke tests for canonical preview payload and shell sanitization expectations.
   - `9564c4d` (`feat`): preview assembler/model/shell integration plus webview preview summary + unifiedPatch rendering.

## Files Created/Modified
- `src/pipeline/preview/previewContracts.ts` - Canonical preview DTOs, versioning, and runtime schema guard.
- `src/pipeline/preview/diffBuilder.ts` - Deterministic unified patch creation and per-file line-delta metadata.
- `src/pipeline/preview/previewAssembler.ts` - Single-source translator from generated file drafts into chat/webview preview bundle outputs.
- `src/ui/previewModel.ts` - Preview model builder/sanitizer with script stripping and Bearer-token redaction.
- `src/ui/previewShell.ts` - Script preview shell HTML wrapper with `preview-root`, serialized model, and approve-all gate copy.
- `src/ui/reviewApp.tsx` - Added preview summary + per-file `unifiedPatch` markup helper reused by preview shell.
- `src/pipeline/preview/diff.d.ts` - Local `diff` module type declarations to keep strict typecheck green.
- `tests/unit/preview-contracts.test.ts` - Contract + deterministic diff tests.
- `tests/smoke/preview-shell.test.ts` - Dual-surface canonical payload and sanitization smoke tests.

## Decisions Made
- Used `assemblePreviewBundle` as the canonical seam between generation outputs and both review surfaces to prevent payload drift.
- Kept sanitization at preview-model/render boundaries to ensure untrusted generated patch content cannot inject executable markup into webview output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added local `diff` declarations to unblock strict typecheck**
- **Found during:** Task 2 verification
- **Issue:** `npm run typecheck` failed because `diff` package has no installed declaration file (`TS7016`).
- **Fix:** Added `src/pipeline/preview/diff.d.ts` with `createTwoFilesPatch` and `structuredPatch` module declarations.
- **Files modified:** `src/pipeline/preview/diff.d.ts`
- **Verification:** `npm run typecheck`, `npm run lint`, `npm run test -- tests/unit/preview-contracts.test.ts`, `npm run test:integration -- tests/smoke/preview-shell.test.ts`
- **Committed in:** `9564c4d`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was required for TypeScript correctness; no scope expansion.

## Issues Encountered
- Git index writes intermittently failed inside sandbox (`index.lock`/`Operation not permitted`), requiring escalated staging/commit commands for task completion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Preview stage now has deterministic, sanitized, canonical payload plumbing for chat + webview approval review.
- Write-gate flows can consume `preview-model` payload and approve-all UX contract without introducing alternate preview channels.

## Self-Check: PASSED
- Verified required output files exist on disk, including `04-03-SUMMARY.md` and all new preview pipeline/UI files.
- Verified all 04-03 task commits are present in git history (`4e14a93`, `e13e157`, `bf2f8d1`, `9564c4d`).

---
*Phase: 04-generation-preview-and-safe-file-writing*
*Completed: 2026-05-31*
