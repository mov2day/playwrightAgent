# Phase 1: Participant and Pipeline Foundation - Research

**Researched:** 2026-05-30
**Domain:** VS Code Copilot Chat participant foundation and gate-safe pipeline orchestration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use layered `src/` module structure from day one (`participant/`, `pipeline/`, `adapters/`, `ui/`, shared contracts).
- **D-02:** Create typed central config + environment reader module (no ad-hoc env reads across modules).
- **D-03:** Add minimal webview shell now (route + placeholder panel), not full UI implementation.
- **D-04:** Define strict adapter interfaces now for local tooling boundaries (`JiraClient`, `ConfluenceClient`) with stub implementations.
- **D-05:** Ticket token parsing is strict: `ABC-123` style tokens only. Non-matching first token is treated as free context unless explicit `--ticket` is used.
- **D-06:** `/plan` with no ticket starts guided follow-up prompt in chat immediately.
- **D-07:** Trailing text after ticket is captured as high-priority user context with source tag `user_input`.
- **D-08:** Invalid ticket format is soft-fail: warn user and offer continue in no-ticket mode.
- **D-09:** Use in-memory request state in phase 1 plus structured event-log sink interface.
- **D-10:** Enforce gate transitions with explicit finite-state machine and allowed-transition table.
- **D-11:** Generate `requestId` per `/plan` run and propagate through all stage events/log records.
- **D-12:** No resume in phase 1; restart behavior marks session interrupted and shows clear user notice.
- **D-13:** Use Vitest as primary test framework for extension/service logic.
- **D-14:** Include lightweight integration tests for command parsing and state transition rules in phase 1.
- **D-15:** Webview testing in phase 1 is smoke-only (panel opens and renders stub payload).
- **D-16:** Phase 1 quality gate requires `lint + typecheck + unit + lightweight integration` before completion.

### the agent's Discretion
- Exact folder/file naming within the chosen layered structure.
- Internal shape of event payload objects, as long as they support `requestId` and gate traceability.
- Selection of lightweight helper utilities for test fixtures/mocks within Vitest.

### Deferred Ideas (OUT OF SCOPE)
- Full Material UI implementation details for tabbed review panel deferred to Phase 3.
- Persistent resume/recovery across restarts deferred to later phase after core state machine is stable.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| `@PlaywrightAgent` participant registration + command routing | Extension host (Node process) | — | VS Code chat participant lifecycle and command handling run in extension backend |
| `/plan` parsing and request context bootstrap | Extension host (Node process) | — | Parsing and validation should remain deterministic and testable server-side |
| Pipeline FSM + transition guards | Extension host (Node process) | — | Non-bypassable gates require centralized backend authority |
| Minimal plan webview shell | Webview client | Extension host bridge | Rendering is client-side; state and actions still originate from extension host |
| Adapter boundaries for Jira/Confluence tooling | Extension host (Node process) | Local CLI/tooling layer | Secrets remain local and outside model prompts |
| Event/audit envelope design (`requestId`) | Extension host (Node process) | Future persistence layer | Correlation and traceability start in phase 1 before persistent logs in later phases |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 1 should establish a strict contract-first extension backbone: participant entrypoint, slash parser, and request-state orchestration as typed services, with no hidden implicit flow. The safest architecture is a deterministic finite-state machine that blocks illegal transitions and emits structured event records for every user action and stage move.

Given current repository assets are mostly docs + existing Playwright helper runtime, the correct Phase 1 strategy is to create new extension source modules while reusing style patterns from `skills/playwright-skill/run.js` (guard clauses, stage banners, defensive error handling). Phase 1 should avoid deep implementation of Jira/Confluence logic and instead define stable adapter interfaces with stubs and strict boundary tests.

**Primary recommendation:** Build a typed extension skeleton with a pure parser module and pure FSM module first, then wire participant/webview shell around those pure units so quality gates are enforceable via unit + lightweight integration tests.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|--------------|---------|---------|--------------|
| TypeScript | 5.x | Typed extension + orchestration contracts | Strongly typed state/event models reduce gate bugs |
| VS Code Extension API (Chat Participant APIs) | VS Code stable matching `engines.vscode` | Register `@PlaywrightAgent`, slash command handlers | Official participant integration surface |
| `zod` | 3.x/4.x | Parse and validate slash command payload/context DTOs | Avoid malformed handoffs between parser and pipeline |
| Vitest | 1.x/2.x | Unit + lightweight integration tests | Fast feedback for parser/FSM invariants |

### Supporting
| Library/Tool | Version | Purpose | When to Use |
|--------------|---------|---------|-------------|
| `@types/vscode` | matching extension API | Type support for extension interfaces | Always with TypeScript extension code |
| `pino` | 9.x | Structured event logs (`requestId`, stage, action) | Begin event schema now; full audit persistence in Phase 5 |
| `@vscode/test-electron` | current | Extension host smoke/integration harness | Optional for phase-1 participant registration smoke tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure transition-table FSM | XState | XState gives tooling/visualization, but adds dependency and runtime complexity for a small first phase |
| Vitest | Jest | Jest is mature but slower for iterative parser/FSM TDD loops |
| `zod` runtime validation | Type-only interfaces | Type-only checks miss malformed runtime payloads from chat input |

**Installation (Phase 1 baseline):**
```bash
npm install zod pino
npm install -D typescript vitest @types/node @types/vscode
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### System Architecture Diagram

```text
Copilot Chat Input
  -> Participant Handler (`@PlaywrightAgent`)
  -> Slash Parser (`/plan` ticket/no-ticket classification)
  -> Request Bootstrap (`requestId`, source-tagged context)
  -> Pipeline FSM (allowed transitions + gate guards)
     -> (if UI event) Webview Shell Bridge
     -> (if adapter stage) Jira/Confluence Interface Stubs
  -> Event Sink (`requestId`, stage, decision)
  -> Chat Response / Await Approval
```

### Recommended Project Structure
```text
src/
├── extension.ts                         # activate + participant registration
├── participant/
│   ├── handler.ts                       # chat participant entry
│   ├── slashPlanParser.ts               # `/plan` parsing and mode resolution
│   └── actions.ts                       # approve/reject/continue/cancel action mapping
├── pipeline/
│   ├── stateMachine.ts                  # deterministic state + transition map
│   ├── events.ts                        # typed event envelope with requestId
│   └── bootstrapContext.ts              # request bootstrap and source tagging
├── adapters/
│   ├── jiraClient.ts                    # interface + stub implementation
│   ├── confluenceClient.ts              # interface + stub implementation
│   └── eventSink.ts                     # interface + in-memory/default sink
├── ui/
│   └── planReviewShell.ts               # minimal webview placeholder registration
└── tests/
    ├── unit/
    ├── integration/
    └── smoke/
```

### Pattern 1: Pure Parser + Structured Parse Result
**What:** Keep `/plan` parsing side-effect free; return discriminated union output (`ticket_mode`, `no_ticket_mode`, `invalid_ticket_soft_fail`).
**When to use:** chat command input that drives multiple pipeline branches.

### Pattern 2: Explicit Transition Table
**What:** Encode allowed state transitions in data (`Record<State, State[]>`) and reject invalid moves centrally.
**When to use:** approval-gated or safety-critical orchestration.

### Pattern 3: Ports-and-Adapters Boundary for External Tooling
**What:** Define adapter interfaces in phase 1 and inject stubs; real local-tool calls come in phase 2.
**When to use:** strict secret boundary and phased delivery.

### Anti-Patterns to Avoid
- Boolean-flag workflow state (`isApproved`, `isGenerated`, `isWritten`) without canonical machine state.
- Parser logic embedded in participant handler side-effects.
- Direct environment variable reads scattered across modules.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime input validation | custom regex/branch maze everywhere | `zod` schemas + centralized parser | Keeps error messages and constraints consistent |
| Event correlation | ad-hoc string concatenation per log call | single `requestId` generator + typed event envelope | Prevents trace drift across stages |
| Gate policy checks | repeated `if` blocks in each stage | central FSM transition validator | Removes policy duplication and bypass bugs |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Ambiguous `/plan` token classification
**What goes wrong:** non-ticket context gets misclassified as ticket and blocks flow.
**Why it happens:** parser accepts any first token.
**How to avoid:** strict `ABC-123` check + explicit soft-fail path.
**Warning signs:** high volume of invalid-ticket errors for human text input.

### Pitfall 2: Illegal transition bypass
**What goes wrong:** generation/write stages execute without required approval state.
**Why it happens:** stage functions mutate state directly.
**How to avoid:** single transition API that validates source->target.
**Warning signs:** logs show stage jumps not listed in transition table.

### Pitfall 3: Correlation loss in logs
**What goes wrong:** impossible to reconstruct one `/plan` run across events.
**Why it happens:** `requestId` not propagated end-to-end.
**How to avoid:** require `requestId` in event type and constructor helpers.
**Warning signs:** mixed request records in same troubleshooting trace.
</common_pitfalls>

<validation_architecture>
## Validation Architecture

### Test Strategy
- **Unit tests (`vitest`)**: parser matrix (`ticket`, `ticket + context`, `no-ticket`, invalid token soft-fail), transition-guard correctness, request bootstrap tags.
- **Light integration tests (`vitest`)**: participant handler -> parser -> FSM routing with mocked chat context.
- **Webview smoke test**: shell registers and renders placeholder payload.

### Required Commands (Phase quality gate)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:integration`

### Verification Targets
1. `/plan` supports both ticket and no-ticket modes (PART-02, PART-03).
2. Every transition event contains `requestId` (PART-04).
3. Participant invoke path is wired and test-covered (PART-01).
</validation_architecture>

<code_examples>
## Code Examples

### Parser Result Shape
```ts
type PlanParseResult =
  | { mode: 'ticket'; ticketId: string; userContext: string }
  | { mode: 'no_ticket'; userContext: string }
  | { mode: 'invalid_ticket_soft_fail'; rawToken: string; userContext: string };
```

### Transition Guard
```ts
function canTransition(from: PipelineState, to: PipelineState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### Adapter Contract Stub
```ts
export interface JiraClient {
  fetchTicketGraph(input: { ticketId: string; requestId: string }): Promise<JiraGraphResult>;
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2026)

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Monolithic command handler | Service-layer parser + orchestrator contracts | Safer testing and easier extension |
| Unstructured logs | Structured event envelopes with correlation IDs | Faster debugging and audit readiness |
| Optional approval checks | Mandatory transition-guarded gates | Governance compliance by construction |
</sota_updates>

<open_questions>
## Open Questions

1. **Extension packaging baseline**
   - What we know: Phase 1 needs runnable extension scaffold with tests.
   - What's unclear: final build tool choice (`tsup`, `esbuild`, or vanilla `tsc`).
   - Recommendation: choose lowest-friction `tsc` first; optimize bundling later.

2. **Webview shell framework in phase 1**
   - What we know: phase 1 requires shell only; full UI in phase 3.
   - What's unclear: plain HTML shell vs React bootstrap in phase 1.
   - Recommendation: use minimal shell with bridge contract, avoid early heavy UI runtime.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `docs/tool.md` — canonical behavior and gate contract
- `docs/playwright_agent_architecture.html` — stage and gate sequence model
- `.planning/ROADMAP.md` — phase goal, success criteria, plan slots
- `.planning/REQUIREMENTS.md` — `PART-01..PART-04`
- `.planning/phases/01-participant-and-pipeline-foundation/01-CONTEXT.md` — locked decisions

### Secondary (HIGH confidence)
- `skills/playwright-skill/run.js` — guard-clause and staged orchestration patterns
- `skills/playwright-skill/lib/helpers.js` — options-driven helper and defensive retry style
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: VS Code participant + slash parser + pipeline FSM
- Patterns: typed parsing, gate-safe transitions, adapter boundary setup
- Testing: lint/typecheck/unit/integration/smoke baseline

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls and mitigations: HIGH
- Validation strategy: HIGH

**Research date:** 2026-05-30
**Valid until:** 2026-06-29
</metadata>

---

*Phase: 01-participant-and-pipeline-foundation*
*Research completed: 2026-05-30*
*Ready for planning: yes*
