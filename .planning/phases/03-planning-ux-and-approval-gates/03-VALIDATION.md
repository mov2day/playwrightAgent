---
phase: 03
slug: planning-ux-and-approval-gates
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-30
---

# Phase 03 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run lint && npm run typecheck && npm run test && npm run test:integration` |
| **Estimated runtime** | ~180 seconds |

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run lint && npm run typecheck && npm run test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PLAN-01, PLAN-02 | T-03-01 | Plan contract includes scenario mapping, risk, assertion summary | unit | `npm run test -- tests/unit/plan-contracts.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PLAN-01 | T-03-02 | Grouped indexes deterministic from flat scenario list | unit | `npm run test -- tests/unit/scenario-grouping.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | PLAN-03, PLAN-04, PLAN-05 | T-03-03 | Webview tabs/per-item/bulk controls render and dispatch correctly | smoke | `npm run test:integration -- tests/smoke/webview-shell.test.ts` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | RUN-04, RUN-05 | T-03-04 | Chat quick actions and free-text routing preserved in review stage | integration | `npm run test:integration -- tests/integration/request-correlation.test.ts` | ✅ | ⬜ pending |
| 03-03-01 | 03 | 3 | PLAN-04, PLAN-05, PLAN-06 | T-03-05 | Scenario approval state sync across chat/webview with pending-only bulk semantics | integration | `npm run test:integration -- tests/integration/approval-sync-flow.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 3 | PLAN-06, RUN-05 | T-03-06 | Rejected/needs_revision scenarios excluded from approved scope and targeted regeneration set | unit | `npm run test -- tests/unit/approval-scope.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending, ✅ green, ❌ red, ⚠️ flaky*

## Wave 0 Requirements

- [ ] `tests/unit/plan-contracts.test.ts` — contract shape and requirement/AC mapping assertions
- [ ] `tests/unit/scenario-grouping.test.ts` — deterministic group index checks
- [ ] `tests/integration/approval-sync-flow.test.ts` — cross-surface state reconciliation and bulk semantics
- [ ] `tests/unit/approval-scope.test.ts` — approved-only generation scope filtering checks

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Review panel visual quality against design direction | PLAN-03 | Aesthetic/interaction quality requires visual judgment | Open webview, verify minimalist base + premium accents + motion discipline against locked design direction |
| Gate copy clarity for comments/revision actions | RUN-04, RUN-05 | Operator comprehension is conversational UX | Run `/plan` gate flow and verify quick actions + free-text prompts are clear and actionable |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify path or Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags in automated verify commands
- [x] Feedback latency target < 180s per loop
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
