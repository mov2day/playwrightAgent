# Release Checklist (Phase 06)

## Go/No-Go Gates

All items below must be green for release.

| Gate | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| SECU-01 boundary proof | Local-tool/env credentials never model-bound | `tests/integration/security-boundary-local-tool-only.test.ts` + `06-01-SUMMARY.md` | PASS |
| SECU-02 leak proof | No unredacted canaries in event/audit persistence | `tests/integration/security-leak-canary.test.ts` + `tests/integration/audit-redaction-persistence.test.ts` | PASS |
| Compile | Extension compiles from source | `npm run compile` | PASS |
| Package | VSIX generated with runtime-only include policy | `npm run package` + `.vscodeignore` | PASS |
| Ticket mode UAT | `/plan <ticket>` end-to-end gates | `06-HUMAN-UAT.md` | PENDING |
| No-ticket mode UAT | `/plan` end-to-end gates | `06-HUMAN-UAT.md` | PENDING |
| Manual verification | Chat/webview diagnostics readability | `06-HUMAN-UAT.md` | PENDING |

## Command Evidence Log

| Command | Timestamp (UTC) | Result | Notes |
| --- | --- | --- | --- |
| `npm run compile` | 2026-06-01T21:11:55Z | pass | `tsc -p ./tsconfig.build.json` succeeded |
| `npm run package` | 2026-06-01T21:18:46Z | pass | VSIX: `playwrightagent-extension-foundation-0.1.0.vsix` (49,255 files, 25.6 MB) |

## Packaging Policy Checks

- [x] `.vscodeignore` exists
- [x] `.vscodeignore` excludes `.planning`, `tests`, `src`, `.github`
- [x] `release/PACKAGING-HARDENING.md` documents include/exclude policy
- [x] Generated VSIX path recorded

## UAT Completion Criteria

- [ ] Ticket mode flow executed and all mandatory gates verified
- [ ] No-ticket mode flow executed and all mandatory gates verified
- [ ] Preview approval and write guardrail semantics verified
- [ ] Run/retry decision loop (`approve/reject/continue/cancel`) verified in UI
- [ ] Chat/webview diagnostics readability verified by human operator

## Final Decision

- Release decision: **PENDING**
- Blockers:
  - Manual UAT items pending
