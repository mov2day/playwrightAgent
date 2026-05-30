# Phase 1: Participant and Pipeline Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 1-Participant and Pipeline Foundation
**Areas discussed:** Extension structure, /plan behavior, Pipeline state model, Phase-1 test scope

---

## Extension Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Layered `src/` modules | participant/pipeline/adapters/ui now | ✓ |
| Flat initial files | minimal setup, refactor later | |
| Multi-package split now | higher upfront complexity | |
| You decide | leave to agent | |

**User's choice:** Layered `src/` modules
**Notes:** User prefers maintainable, extensible baseline now.

| Option | Description | Selected |
|--------|-------------|----------|
| Typed central config + env reader | one source of config truth | ✓ |
| Ad-hoc env reads | faster initially, drift risk | |
| Hardcoded defaults only | not suitable for secure/tooling flows | |
| You decide | leave to agent | |

**User's choice:** Typed central config + env reader
**Notes:** Explicitly avoids per-module env handling.

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal webview shell now | route + placeholder for future phases | ✓ |
| Defer webview to Phase 3 | less immediate setup | |
| Full MUI scaffold now | too heavy for foundation phase | |
| You decide | leave to agent | |

**User's choice:** Minimal webview shell now
**Notes:** Keep phase lean but unblock future UI integration.

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter interfaces now | strict boundaries + stub impls | ✓ |
| Direct script calls first | faster, less safe boundary | |
| No adapter layer | high coupling | |
| You decide | leave to agent | |

**User's choice:** Adapter interfaces now
**Notes:** Security/tooling boundary treated as foundational.

---

## `/plan` Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Strict ticket token format | `ABC-123` ticket parsing only | ✓ |
| Accept any first token | ambiguous classification risk | |
| Require `--ticket` always | more friction for users | |
| You decide | leave to agent | |

**User's choice:** Strict ticket token format
**Notes:** Non-matching first token treated as free context by design.

| Option | Description | Selected |
|--------|-------------|----------|
| Guided prompt in no-ticket mode | immediate context capture | ✓ |
| Usage error only | no guidance | |
| Open webview form first | heavier interaction path | |
| You decide | leave to agent | |

**User's choice:** Guided prompt in no-ticket mode
**Notes:** Fast chat-first UX prioritized.

| Option | Description | Selected |
|--------|-------------|----------|
| Trailing text as high-priority context | source-tagged `user_input` | ✓ |
| Low-priority note only | weaker intent preservation | |
| Ignore trailing text | drops user intent | |
| You decide | leave to agent | |

**User's choice:** High-priority user context
**Notes:** Matches earlier project-level decision weighting.

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-fail invalid ticket | warn + continue in no-ticket mode | ✓ |
| Hard-fail invalid ticket | strict but disruptive | |
| Auto-normalize | guessy/unsafe behavior | |
| You decide | leave to agent | |

**User's choice:** Soft-fail invalid ticket
**Notes:** Keep workflow moving without hidden assumptions.

---

## Pipeline State Model

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory state + event sink interface | simple now, extensible later | ✓ |
| Persistent file state now | higher upfront complexity | |
| Global mutable singleton only | poor traceability | |
| You decide | leave to agent | |

**User's choice:** In-memory + event sink interface
**Notes:** Balance speed and future audit logging evolution.

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit finite-state machine | allowed-transition table | ✓ |
| Boolean gate flags | easy to drift/inconsistency | |
| Implicit checks only | hard to verify | |
| You decide | leave to agent | |

**User's choice:** Explicit FSM
**Notes:** Mandatory for non-bypassable gate guarantees.

| Option | Description | Selected |
|--------|-------------|----------|
| Request correlation ID | propagate `requestId` everywhere | ✓ |
| Timestamp-only logs | weaker correlation | |
| Add later | delays observability baseline | |
| You decide | leave to agent | |

**User's choice:** Request correlation ID
**Notes:** Required foundation for auditability.

| Option | Description | Selected |
|--------|-------------|----------|
| No resume yet, explicit interrupted notice | safe and transparent | ✓ |
| Partial auto-resume | premature complexity | |
| Silent reset | unsafe, confusing | |
| You decide | leave to agent | |

**User's choice:** No resume yet + clear interrupted notice
**Notes:** Resume behavior deferred to later phase.

---

## Phase-1 Test Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest | unit/service test baseline | ✓ |
| Jest | alternative runner | |
| No tests in phase 1 | violates success criteria | |
| You decide | leave to agent | |

**User's choice:** Vitest
**Notes:** Lightweight and fast foundation.

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight integration tests | parser + state transition coverage | ✓ |
| Unit only | lower confidence on flow wiring | |
| Full VS Code host integration now | too heavy for phase scope | |
| You decide | leave to agent | |

**User's choice:** Lightweight integration tests
**Notes:** Enough signal for phase success criteria.

| Option | Description | Selected |
|--------|-------------|----------|
| Webview smoke-only | panel open + payload stub | ✓ |
| Full component tests now | premature depth | |
| Skip webview tests | misses shell validation | |
| You decide | leave to agent | |

**User's choice:** Webview smoke-only
**Notes:** Minimal check to support future UI phase.

| Option | Description | Selected |
|--------|-------------|----------|
| Full phase gate: lint + typecheck + unit + light integration | release-safe foundation | ✓ |
| Typecheck only | insufficient coverage | |
| Unit only | misses type/lint/integration | |
| You decide | leave to agent | |

**User's choice:** Full quality gate
**Notes:** Required before phase completion.

---

## the agent's Discretion

- Folder/file naming details within layered module decision.
- Exact mock/test fixture structures under Vitest.
- Internal event payload format details (while preserving `requestId` propagation).

## Deferred Ideas

- Full Material UI webview implementation in Phase 3.
- Persistent restart resume flow in a later phase.
