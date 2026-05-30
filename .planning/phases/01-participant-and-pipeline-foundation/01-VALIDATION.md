---
phase: 01
slug: participant-and-pipeline-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-30
---

# Phase 01 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` (created in 01-01) |
| **Quick run command** | `npm run test -- --runInBand` |
| **Full suite command** | `npm run lint && npm run typecheck && npm run test && npm run test:integration` |
| **Estimated runtime** | ~120 seconds |

## Sampling Rate

- **After every task commit:** Run `npm run test -- --runInBand`
- **After every plan wave:** Run `npm run lint && npm run typecheck && npm run test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PART-01 | T-01-01 | Participant registration path errors fast on missing config | unit | `npm run test -- tests/unit/participant-registration.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | PART-01 | T-01-02 | Activation registers `@PlaywrightAgent` only once | integration | `npm run test:integration -- tests/integration/activation.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | PART-02 | T-01-03 | Strict ticket parsing and safe invalid-ticket fallback | unit | `npm run test -- tests/unit/slash-plan-parser.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | PART-03 | T-01-04 | No-ticket guided prompt starts immediately | integration | `npm run test:integration -- tests/integration/no-ticket-flow.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 3 | PART-04 | T-01-05 | FSM blocks illegal transitions and enforces gate order | unit | `npm run test -- tests/unit/pipeline-state-machine.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 3 | PART-04 | T-01-06 | `requestId` propagates across all stage events | integration | `npm run test:integration -- tests/integration/request-correlation.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending, ✅ green, ❌ red, ⚠️ flaky*

## Wave 0 Requirements

- [ ] `package.json` scripts for `lint`, `typecheck`, `test`, `test:integration`
- [ ] `tsconfig.json` + baseline TypeScript build settings
- [ ] `vitest.config.ts` + initial test setup
- [ ] `src/extension.ts` activation entrypoint and participant registration shell

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chat participant appears and accepts `/plan` | PART-01, PART-02 | Requires VS Code Copilot chat host runtime | Start extension host, open Copilot Chat, invoke `@PlaywrightAgent`, run `/plan ABC-123` and `/plan` |
| Webview shell opens | PART-04 (gate UX baseline) | Visual panel rendering check | Trigger plan-preview shell action and confirm placeholder content renders |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify path or Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags in automated verify commands
- [x] Feedback latency target < 120s per loop
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
