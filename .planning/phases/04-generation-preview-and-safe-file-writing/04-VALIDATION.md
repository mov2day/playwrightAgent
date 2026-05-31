---
phase: 04
slug: generation-preview-and-safe-file-writing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/unit` |
| **Full suite command** | `npm run test && npm run test:integration` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/unit`
- **After every plan wave:** Run `npm run test && npm run test:integration`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | GEN-01 | — | Approved scope only; rejected scenarios excluded from generation input | unit + integration | `npm run test -- tests/unit/approval-scope.test.ts tests/integration/approval-sync-flow.test.ts` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | GEN-03 | — | No file writes before explicit preview approval | integration + smoke | `npm run test -- tests/integration/request-correlation.test.ts tests/smoke/webview-review-tabs.test.ts` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 2 | GEN-04, GEN-05, GEN-06 | — | Surgical no-delete writes + lint/type retry/escalation gating | integration | `npm run test:integration` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preview readability and reviewer clarity in chat + webview | GEN-03 | Human UX quality is subjective and not fully assertable by unit tests | Run `/plan`, review preview payload in chat + webview, confirm summary and patch are both understandable before approving |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
