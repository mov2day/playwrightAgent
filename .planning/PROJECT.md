# PlaywrightAgent

## What This Is

PlaywrightAgent is a VS Code extension feature invoked through a Copilot Chat participant (`@PlaywrightAgent`) to generate enterprise-grade Playwright tests from requirement context. It orchestrates repo analysis, Jira and Confluence context collection, confidence scoring, approval-gated planning/generation, and local test execution. It is designed for QA teams that need production-ready tests with strict governance and traceability.

## Core Value

Generate accurate, directly runnable Playwright tests with mandatory human approvals and zero secret exposure to the AI model.

## Requirements

### Validated

- ✓ Repository already includes skill-driven Playwright guidance and architecture docs for enterprise orchestration (`docs/tool.md`, `docs/playwright_agent_architecture.html`) — existing
- ✓ Repository already includes executable local runtime for Playwright script execution from file, inline input, or stdin (`skills/playwright-skill/run.js`) — existing
- ✓ Repository already includes reusable helper utilities for browser lifecycle and interaction primitives (`skills/playwright-skill/lib/helpers.js`) — existing

### Active

- [ ] Provide VS Code Copilot Chat participant entrypoint `@PlaywrightAgent` with slash command `/plan <JIRA-ID> [extra-context]`
- [ ] Support no-ticket mode in `/plan` so user can generate plan/tests from manual context only
- [ ] Implement AI-driven repo analysis stage that detects framework, patterns (POM/Screenplay), reusable helpers, and safe insertion strategy
- [ ] Implement deep Jira retrieval via local tooling, including epic/parent/sub-task/linked-issue/attachments traversal
- [ ] Implement Confluence retrieval via local tooling with AI-generated query strategy based on Jira context
- [ ] Implement weighted confidence model: reject `<40`, user gate `40-70`, auto-continue `>70`; Confluence helps only when relevant
- [ ] Implement plan generation mapped to requirements/acceptance criteria with risk annotations and coverage mapping
- [ ] Render plan in both chat and VS Code webview (professional Material UI tabs, grouped views, per-test + bulk approve/reject)
- [ ] Generate tests only for approved plan items; hard-exclude rejected items
- [ ] Add second preview gate for generated scripts before any file write
- [ ] Write via append/surgical updates only; never clobber unrelated existing tests
- [ ] Run lint/type checks after generation; auto-fix first pass; escalate to user if retries needed
- [ ] Offer local test execution for generated scripts; attempt one auto-fix cycle on failures, then hand control to user
- [ ] Provide quick actions in chat (`approve`, `reject`, `continue`, `cancel`) plus freeform comment loop that re-enters approval
- [ ] Log all AI interactions for auditability

### Out of Scope

- Non-Playwright test frameworks in v1 — focus on Playwright-only execution quality first
- Direct Jira/Confluence cloud calls from AI model — forbidden by security design (tooling-only access)
- Fully autonomous bypass of approval gates — conflicts with governance and QA review intent
- Broad auto-remediation loops beyond first retry cycle — avoids hidden churn and unsafe mutation in v1
- Full multi-repo orchestration in v1 — defer until single-repo flow is stable

## Context

Current workspace already contains architecture and behavior contracts describing the intended pipeline and gates. Existing assets include enterprise workflow docs, Playwright skill documents, and a local executor/helper runtime. The new work turns these artifacts into a complete VS Code extension flow for QA users, preserving strict human-in-the-loop approval and secure local-tool-based data retrieval.

## Constraints

- **Tech Stack**: Build as a VS Code extension + Copilot Chat participant; choose best maintainable and extensible architecture
- **Language/Runtime**: Use Node/TypeScript-friendly extension patterns compatible with existing Playwright ecosystem
- **Security**: Jira/Confluence credentials remain in environment variables and local tooling only; never passed to AI prompt context
- **Governance**: Approval gates are mandatory before plan execution and file writes
- **Observability**: All AI interactions must be logged for audit and troubleshooting
- **Write Safety**: Existing spec files must be preserved; updates are append/surgical only
- **Quality Bar**: Generated tests must be executable with no placeholder or speculative behavior

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `/plan <JIRA-ID> [extra-context]` as primary command | Clear single entrypoint in Copilot participant flow | — Pending |
| Allow no-ticket mode | QA needs fast planning for manual/ad-hoc scenarios | — Pending |
| Confidence policy A (`<40` reject, `40-70` gate, `>70` continue) | Balances safety with execution speed; removes overlap ambiguity | — Pending |
| User context is bonus, missing user context is not penalty | Preserve deterministic behavior for ticket-only flows | — Pending |
| Confluence low-quality results are neutral, high-quality results are bonus | Avoid penalizing weak wiki signal while benefiting useful docs | — Pending |
| v1 target is full E2E flow (not just stubs/spec) | User explicitly prioritized working end-to-end system | — Pending |
| v1 primary user persona is QA engineer | Focuses UX language, gating, and reporting on QA workflows | — Pending |
| Jira/Confluence access stays local-tool-only | Hard security requirement from user | — Pending |
| Log all AI interactions | Supports enterprise audit/compliance expectations | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -> still right priority?
3. Audit Out of Scope -> reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-29 after initialization*
