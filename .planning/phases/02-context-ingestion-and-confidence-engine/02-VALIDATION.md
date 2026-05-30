---
phase: 02
slug: context-ingestion-and-confidence-engine
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-30
---

# Phase 02 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --runInBand` |
| **Full suite command** | `npm run lint && npm run typecheck && npm run test && npm run test:integration` |
| **Estimated runtime** | ~180 seconds |

## Sampling Rate

- **After every task commit:** Run `npm run test -- --runInBand`
- **After every plan wave:** Run `npm run lint && npm run typecheck && npm run test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | REPO-01, REPO-02 | T-02-01 | Analyzer classifies framework/pattern with confidence and evidence | unit | `npm run test -- tests/unit/repo-analyzer.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | REPO-03, REPO-04 | T-02-02 | Reuse detection and summary output remain deterministic | unit | `npm run test -- tests/unit/repo-analyzer-summary.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | JIRA-01, JIRA-02, JIRA-06 | T-02-03 | Local-tool-only Jira ingestion with epic linking and request caps | unit | `npm run test -- tests/unit/jira-client.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | JIRA-03, JIRA-04, JIRA-05 | T-02-04 | Task/subtask/linked traversal obeys deep-fetch + dedupe rules | unit | `npm run test -- tests/unit/jira-graph-traversal.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | CONF-01 | T-02-05 | Confluence query builder derives queries from Jira context only | unit | `npm run test -- tests/unit/confluence-query-builder.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | CONF-02 | T-02-06 | Low relevance excluded, mid neutral, high additive with freshness decay | unit | `npm run test -- tests/unit/confluence-relevance.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 3 | CONF-03, CONF-04, CONF-05, CONF-06 | T-02-07 | Confidence composition enforces threshold policy exactly | unit | `npm run test -- tests/unit/confidence-engine.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 3 | CONF-05, CONF-06 | T-02-08 | Gate payload exposes Continue/Cancel + sanitized explainability and free-text path | integration | `npm run test:integration -- tests/integration/confidence-gate-flow.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending, ✅ green, ❌ red, ⚠️ flaky*

## Wave 0 Requirements

- [ ] `tests/unit/repo-analyzer.test.ts` — analyzer baseline coverage scaffolding
- [ ] `tests/unit/jira-graph-traversal.test.ts` — traversal rule harness
- [ ] `tests/unit/confluence-relevance.test.ts` — relevance thresholds test fixture
- [ ] `tests/unit/confidence-engine.test.ts` — gate policy regression checks

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chat gate explanation readability | CONF-03, CONF-05 | UX wording quality and operator interpretation | Run `/plan` with simulated contexts and confirm breakdown clarity and action visibility |
| Free-text gate feedback loop | CONF-05 | End-to-end conversational behavior in Copilot host | Use `Continue/Cancel` quick actions and free-text instruction flow in participant session |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify path or Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags in automated verify commands
- [x] Feedback latency target < 180s per loop
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
