# Phase 2: Context Ingestion and Confidence Engine - Pattern Map

**Generated:** 2026-05-30
**Phase:** 02-context-ingestion-and-confidence-engine
**Inputs:** `02-CONTEXT.md`, `02-RESEARCH.md`

## Pattern Summary

Phase 2 builds on Phase 1's deterministic contracts and request-scoped orchestration. Existing repository patterns strongly favor:
- explicit typed contracts
- guard-first flow control
- bounded retry behavior
- isolated adapter boundaries

Implementation should preserve those patterns while adding graph traversal, relevance scoring, and explainable confidence composition.

## File-Level Mapping

| Planned File | Role | Data Flow Position | Closest Analog | Pattern to Reuse |
|--------------|------|--------------------|----------------|------------------|
| `src/pipeline/repoAnalysis/contracts.ts` | Typed analyzer contracts | repo scan -> findings | `src/pipeline/contracts.ts` | discriminated unions + stable DTO contracts |
| `src/pipeline/repoAnalysis/repoAnalyzer.ts` | Orchestrator for detector passes | request bootstrap -> repo summary | `skills/playwright-skill/run.js` | staged pipeline with explicit guard/fallback |
| `src/adapters/jiraClient.ts` | Local-tool Jira adapter | ingestion stage -> raw ticket graph | `src/adapters/eventSink.ts` boundary style | interface-first adapter with injectable implementation |
| `src/adapters/jiraGraphTraversal.ts` | Graph expansion + dedupe | raw graph -> bounded enriched graph | `src/pipeline/stateMachine.ts` | deterministic rule table + strict allowed transitions |
| `src/pipeline/context/confluenceRelevance.ts` | Weighted relevance scorer | confluence payload -> scored contexts | `src/pipeline/events.ts` | normalized typed output with explainability fields |
| `src/pipeline/confidence/confidenceEngine.ts` | Component score composition | repo+jira+confluence+user -> gate decision | `src/pipeline/orchestrator.ts` | explicit transition thresholds and decision records |
| `src/pipeline/confidence/explainability.ts` | Sanitized evidence rendering | score output -> user/audit payload | `src/participant/handler.ts` | response contract shaping separate from core logic |

## Concrete Code Excerpts (Analog Evidence)

### 1) Explicit transition policy and deterministic guards
From `src/pipeline/stateMachine.ts`:
```ts
export const ALLOWED_TRANSITIONS: Readonly<Record<PipelineState, readonly PipelineState[]>> = {
  initialized: ['awaiting_plan_approval', 'cancelled'],
  awaiting_plan_approval: ['plan_approved', 'plan_rejected', 'cancelled']
};
```

Reuse for confidence gate policy:
- `<40` -> `reject`
- `40-70` -> `approval_required`
- `>70` -> `continue`

### 2) Request-scoped orchestration surface
From `src/pipeline/orchestrator.ts`:
```ts
private readonly sessions = new Map<string, PipelineSession>();
```

Reuse for ingestion and scoring telemetry:
- preserve `requestId`
- emit stage-specific events
- avoid global mutable scoring state

### 3) Guarded staged runtime pattern
From `skills/playwright-skill/run.js`:
```js
if (!checkPlaywrightInstalled()) {
  const installed = installPlaywright();
  if (!installed) {
    process.exit(1);
  }
}
```

Reuse for adapter stages:
- validate tool response
- enforce caps/time budgets
- degrade to partial result with explicit completeness flags

## Pattern Rules for Planner/Executor

1. Keep adapters side-effecting and tool-facing; keep scoring/analyzer logic pure and testable.
2. Every adapter output must include provenance + completeness metadata.
3. Never bind Confluence outcome as authoritative override over Jira context.
4. Confidence composition must remain deterministic for identical input payloads.
5. Gate payload generation must run through sanitizer before any chat/webview/audit emission.

## Anti-Patterns to Reject

- Parsing Jira/Confluence tool payloads without runtime schema validation.
- Unbounded recursive traversal without hard caps and dedupe.
- Single opaque confidence number with no component reasoning.
- Emitting raw attachment excerpts or secret-bearing request headers in explainability output.

---

*Pattern mapping status: complete*
*Ready for planning: yes*
