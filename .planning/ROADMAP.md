# Roadmap: PlaywrightAgent

## Overview

This roadmap delivers a full enterprise-grade `@PlaywrightAgent` Copilot participant for QA teams, from participant foundation through secure context ingestion, confidence-gated planning, approval-driven script generation, safe writes, and run/report closure. Phase order enforces governance-first architecture so no generation or mutation occurs before confidence and human approvals are in place.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Participant and Pipeline Foundation** - Build VS Code participant entry, slash-command parsing, and orchestration state machine.
- [x] **Phase 2: Context Ingestion and Confidence Engine** - Implement repo analysis + secure Jira/Confluence fetch + confidence scoring gates. (completed 2026-05-30)
- [x] **Phase 3: Planning UX and Approval Gates** - Deliver chat + MUI webview plan presentation with per-scenario and bulk approvals. (completed 2026-05-31)
- [ ] **Phase 4: Generation, Preview, and Safe File Writing** - Generate approved scripts only, enforce preview gate, and perform surgical writes.
- [ ] **Phase 5: Execution, Retry Loop, and Audit Logging** - Run generated tests, controlled fix loop, and full AI interaction audit trail.
- [ ] **Phase 6: Stabilization and v1 Readiness** - Hardening, verification, and documentation closeout for release-quality v1.

## Phase Details

### Phase 1: Participant and Pipeline Foundation
**Goal**: Establish extension scaffold, `@PlaywrightAgent` participant, `/plan` command (ticket + no-ticket), and deterministic gate-capable pipeline state.
**Depends on**: Nothing (first phase)
**Requirements**: PART-01, PART-02, PART-03, PART-04
**Success Criteria** (what must be TRUE):
  1. QA can invoke `@PlaywrightAgent` and `/plan` in both ticket and no-ticket modes.
  2. Pipeline state persists request flow and supports cancel/continue transitions safely.
  3. Foundation tests verify command parsing and stage routing behavior.
**Plans**: 3 plans

Plans:
- [x] 01-01: Extension scaffold and chat participant registration
- [x] 01-02: Slash command parser and request context bootstrap
- [x] 01-03: Pipeline state machine and gate transition guards

### Phase 2: Context Ingestion and Confidence Engine
**Goal**: Build reliable repo analysis and secure Jira/Confluence context fusion with thresholded confidence decisions.
**Depends on**: Phase 1
**Requirements**: REPO-01, REPO-02, REPO-03, REPO-04, JIRA-01, JIRA-02, JIRA-03, JIRA-04, JIRA-05, JIRA-06, CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06
**Success Criteria** (what must be TRUE):
  1. Repo analyzer detects framework/pattern/reuse signals and reports summary output.
  2. Jira local-tool fetch performs deep traversal for epic/task/subtask/linked graph rules, including always-linked epic retrieval.
  3. Confidence policy enforces `<40` reject, `40-70` approval gate, `>70` continue, with explainable component scores.
  4. Confluence low-relevance context is neutralized and high-relevance context is additive only.
**Plans**: 4 plans

Plans:
- [x] 02-01: Repo analyzer service and pattern classifier
- [x] 02-02: Jira local-tool adapter and deep traversal contracts
- [x] 02-03: Confluence local-tool adapter and relevance scoring
- [x] 02-04: Confidence engine + gate decision integration

### Phase 3: Planning UX and Approval Gates
**Goal**: Produce requirement-mapped test plans and approval-first review surfaces in chat and webview.
**Depends on**: Phase 2
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, RUN-04, RUN-05
**Success Criteria** (what must be TRUE):
  1. Plan output includes scenario name, risk, assertion intent, and requirement/AC mapping.
  2. Webview shows tabbed grouped scenario list with per-item and bulk approve/reject.
  3. Rejected scenarios are excluded from downstream generation scope in same run.
  4. Chat quick actions and freeform comments both drive gate progression/revision loops.
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Plan generation prompt/contracts and mapping renderer
- [x] 03-02-PLAN.md — MUI webview review panel with grouped tabs and bulk actions
- [x] 03-03-PLAN.md — Approval state synchronization across chat and webview

### Phase 4: Generation, Preview, and Safe File Writing
**Goal**: Generate tests only from approved scenarios, require preview approval, and write safely to repo files.
**Depends on**: Phase 3
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06
**Success Criteria** (what must be TRUE):
  1. Only approved scenarios are generated; rejected scenarios never appear in script output.
  2. Generated scripts follow detected repo conventions and reuse existing abstractions.
  3. Preview gate blocks all file writes until explicit user approval.
  4. Writes are append/surgical and preserve unrelated existing tests.
  5. Lint/type checks run automatically; first retry failure escalates to user decision.
**Plans**: 3 plans

Plans:
- [ ] 04-01: Approved-scope test generation pipeline
- [ ] 04-02: Preview diff UX and approval hooks
- [ ] 04-03: Surgical writer + lint/type guardrail flow

### Phase 5: Execution, Retry Loop, and Audit Logging
**Goal**: Close loop with execution outcomes, controlled remediation, and full auditability.
**Depends on**: Phase 4
**Requirements**: RUN-01, RUN-02, RUN-03, SECU-03, SECU-04
**Success Criteria** (what must be TRUE):
  1. User can run generated tests and receive clear pass/fail diagnostics.
  2. Agent attempts one controlled fix loop for failures, then requests user direction.
  3. All AI interactions and gate decisions are persisted with redaction applied.
**Plans**: 3 plans

Plans:
- [ ] 05-01: Scoped run executor and report summarizer
- [ ] 05-02: One-shot repair loop with escalation controls
- [ ] 05-03: Structured AI interaction audit log pipeline

### Phase 6: Stabilization and v1 Readiness
**Goal**: Validate v1 end-to-end quality, secure defaults, and release readiness docs.
**Depends on**: Phase 5
**Requirements**: SECU-01, SECU-02
**Success Criteria** (what must be TRUE):
  1. Secret boundary is verified: Jira/Confluence creds stay local tooling only.
  2. Prompt/audit checks confirm no secret leakage to model context.
  3. End-to-end UAT for ticket and no-ticket modes passes against v1 must-haves.
  4. Release checklist and operator usage docs are complete.
**Plans**: 2 plans

Plans:
- [ ] 06-01: Security boundary verification and leak checks
- [ ] 06-02: End-to-end UAT, docs, and release readiness

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Participant and Pipeline Foundation | 3/3 | Complete | 2026-05-30 |
| 2. Context Ingestion and Confidence Engine | 4/4 | Complete    | 2026-05-30 |
| 3. Planning UX and Approval Gates | 3/3 | Complete | 2026-05-31 |
| 4. Generation, Preview, and Safe File Writing | 0/3 | Not started | - |
| 5. Execution, Retry Loop, and Audit Logging | 0/3 | Not started | - |
| 6. Stabilization and v1 Readiness | 0/2 | Not started | - |
