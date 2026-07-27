---
phase: 06
slug: stabilization-and-v1-readiness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (integration + unit), npm script gates |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/integration/audit-redaction-persistence.test.ts tests/integration/no-ticket-flow.test.ts` |
| **Full suite command** | `npm run test && npm run compile && npm run package` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/integration/audit-redaction-persistence.test.ts tests/integration/no-ticket-flow.test.ts`
- **After every plan wave:** Run `npm run test && npm run compile && npm run package`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 240 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SECU-01 | T-06-01 | Credentials remain local-tool/env-only; no prompt/event credential echo | integration | `npm run test -- tests/integration/security-boundary-local-tool-only.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | SECU-02 | T-06-02 | Leak-canary secrets always redacted before persistence and never model-bound | integration | `npm run test -- tests/integration/security-leak-canary.test.ts tests/integration/audit-redaction-persistence.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | SECU-01, SECU-02 | T-06-03 | Ticket/no-ticket UAT matrix passes across all required gates | manual+integration | `npm run test -- tests/integration/no-ticket-flow.test.ts tests/integration/execution-run-flow.test.ts` | ✅ | ⬜ pending |
| 06-02-02 | 02 | 2 | SECU-01, SECU-02 | T-06-04 | Release package built with runtime-only artifact policy and documented operator procedure | command+manual | `npm run compile && npm run package` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/security-boundary-local-tool-only.test.ts` — boundary regression coverage scaffold for SECU-01
- [ ] `tests/integration/security-leak-canary.test.ts` — leak-canary coverage scaffold for SECU-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VS Code chat + webview diagnostics readability and gate UX closure | SECU-01, SECU-02 carry-over UAT evidence | Headless tests cannot validate operator readability and panel interaction quality | Follow `06-HUMAN-UAT.md`; execute ticket/no-ticket flows in VS Code and capture outcomes/screenshots. |
| VSIX install smoke check from packaged artifact | Release readiness | Packaging command success alone does not prove installability and runtime activation behavior | Install generated `.vsix` in VS Code, verify participant registration and basic `/plan` invocation. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 240s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
