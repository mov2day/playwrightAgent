# Project Research Summary

**Project:** PlaywrightAgent
**Domain:** VS Code Copilot Playwright orchestration extension
**Researched:** 2026-05-29
**Confidence:** HIGH

## Executive Summary

Research confirms this project should be built as a typed, stage-gated VS Code chat participant extension with strict local-tool boundaries for Jira/Confluence access. The core architecture is feasible with existing official APIs: chat participant registration + slash commands in VS Code, Jira issue graph retrieval endpoints, Confluence CQL search endpoints, and Playwright execution/reporting flows.

The strongest success factor is governance architecture, not raw test generation: enforce deterministic gates, preserve existing test files, and keep credential-bearing operations outside model context. The recommended approach is a contract-driven pipeline (repo analysis -> context fetch -> confidence -> plan -> approvals -> generation -> preview -> write -> run) with structured logging across all stages.

## Key Findings

### Recommended Stack

TypeScript + Node LTS + VS Code Chat Participant API + Playwright runtime + MUI webview UI is the best balance of maintainability and extensibility.

**Core technologies:**
- VS Code Chat Participant API: participant + slash command workflow
- Playwright Test 1.57+: generated script execution and run diagnostics
- Local tooling wrappers: secure Jira/Confluence fetch boundaries

### Expected Features

**Must have (table stakes):**
- `/plan <JIRA-ID> [context]` and no-ticket mode
- Deep Jira + Confluence context ingestion
- Confidence thresholds with gate behavior
- Plan and preview approvals before generation/writes
- Safe writes + lint/type/run path + AI interaction logging

**Should have (competitive):**
- Requirement-to-scenario mapping
- Grouped review UI with bulk actions
- Controlled one-shot repair loop

**Defer (v2+):**
- Multi-repo orchestration
- Non-Playwright adapters

### Architecture Approach

Use explicit stage contracts with blocking gate transitions. Keep local tooling adapters isolated from AI prompts, and persist audit logs for every model interaction and human decision.

**Major components:**
1. Participant controller and slash command layer
2. Context pipeline (repo/Jira/Confluence/scoring)
3. Plan + review UX (chat + webview)
4. Generation/write/run executors
5. Audit logging and state persistence

### Critical Pitfalls

1. Pattern mis-detection in repo analysis -> fix with multi-signal detection + confidence
2. Incomplete Jira graph traversal -> fix with explicit relationship expansion policy
3. Gate bypass by async state bugs -> fix with strict state machine
4. Unsafe full-file rewrites -> fix with surgical append/patch path

## Implications for Roadmap

### Phase 1: Extension Foundation and Participant Entry
**Rationale:** everything depends on a stable participant, slash command, and state machine baseline.
**Delivers:** extension scaffold, participant registration, `/plan` parsing, gate-state core.
**Addresses:** entrypoint and governance foundation.
**Avoids:** gate bypass pitfall early.

### Phase 2: Context Ingestion and Confidence Engine
**Rationale:** plan quality depends on deterministic context quality.
**Delivers:** repo analyzer, Jira deep fetch adapter, Confluence adapter, confidence scorer.
**Uses:** local tooling security boundary patterns.
**Implements:** normalization and scoring contracts.

### Phase 3: Planning + Approval UX
**Rationale:** must lock approval UX before generation stage.
**Delivers:** chat plan output, webview tabbed grouped review, approve/reject actions.

### Phase 4: Generation, Preview Gate, and Safe Writes
**Rationale:** generation must stay blocked by explicit approvals.
**Delivers:** approved-only generation, diff previews, append/surgical writer, lint/type loop.

### Phase 5: Execution, Reporting, and Audit Hardening
**Rationale:** complete end-to-end outcome required for v1 definition of done.
**Delivers:** run selected generated scripts, summarize failures, one retry path, interaction logging.

### Phase Ordering Rationale

- Governance primitives first, generation second.
- Context reliability before plan UI before write/run mutation.
- Security and audit requirements integrated throughout, not bolted on at end.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Jira/Confluence traversal edge cases, attachment handling constraints.
- **Phase 4:** Safe patching strategy in mixed test architectures.

Phases with standard patterns (lighter research needed):
- **Phase 1:** VS Code participant scaffolding.
- **Phase 5:** Playwright run/report integration flow.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | official VS Code/Playwright/MUI references available |
| Features | HIGH | user-provided scope is detailed and explicit |
| Architecture | HIGH | pipeline decomposition matches proven extension patterns |
| Pitfalls | HIGH | governance/security pitfalls clearly identified |

**Overall confidence:** HIGH

### Gaps to Address

- Clarify exact Jira/Confluence local-tool contract payload shapes.
- Define final scoring formula weights in config for tunable behavior.
- Decide AST vs diff strategy for surgical write implementation.

## Sources

### Primary (HIGH confidence)
- https://code.visualstudio.com/api/extension-guides/chat
- https://code.visualstudio.com/api/extension-guides/ai/chat-tutorial
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-attachments/
- https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-search/
- https://playwright.dev/docs/best-practices

### Secondary (MEDIUM confidence)
- https://mui.com/versions/

---
*Research completed: 2026-05-29*
*Ready for roadmap: yes*
