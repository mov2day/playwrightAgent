# Phase 3: Planning UX and Approval Gates - Pattern Map

**Mapped:** 2026-05-30  
**Files in phase scope:** 13  
**Analogs found (phase scope):** 12 / 13  
**Reference-only files analyzed (not phase-owned):** 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pipeline/planning/planContracts.ts` | model | transform | `src/pipeline/contracts.ts` | exact |
| `src/pipeline/planning/scenarioMapper.ts` | service | batch | `src/pipeline/context/jiraContextBuilder.ts` | role+flow |
| `src/pipeline/planning/scenarioGrouping.ts` | utility | transform | `src/pipeline/context/confluenceQueryBuilder.ts` | exact |
| `src/pipeline/planning/approvalScope.ts` | utility | transform | `src/pipeline/context/confluenceContextBuilder.ts` | flow-match |
| `src/pipeline/orchestrator.ts` | service | event-driven | `src/pipeline/orchestrator.ts` | exact |
| `src/pipeline/stateMachine.ts` | utility | event-driven | `src/pipeline/stateMachine.ts` | exact |
| `src/participant/handler.ts` | controller | request-response | `src/participant/handler.ts` | exact |
| `src/ui/planReviewShell.ts` | component | request-response | `src/ui/planReviewShell.ts` | exact |
| `src/ui/reviewModel.ts` | model | transform | `src/pipeline/confidence/explainability.ts` | role-match |
| `src/ui/reviewActions.ts` | utility | event-driven | `src/participant/actions.ts` | role+flow |
| `src/ui/reviewApp.tsx` (implied by D-08 React+MUI) | component | event-driven | _none_ | none |
| `tests/integration/request-correlation.test.ts` | test | event-driven | `tests/integration/request-correlation.test.ts` | exact |
| `tests/smoke/webview-shell.test.ts` | test | request-response | `tests/smoke/webview-shell.test.ts` | exact |

## Reference-Only Pattern Sources (Out of Phase 03 Plan Ownership)

These files are used as behavioral analogs for pattern guidance but are not modified by Phase 03 plans.

| File | Why referenced |
|---|---|
| `tests/integration/confidence-gate-flow.test.ts` | Existing gate/recompute assertion style reused as test design input |
| `tests/unit/pipeline-state-machine.test.ts` | Existing transition legality assertion style reused as test design input |

## Pattern Assignments

### `src/pipeline/planning/planContracts.ts` (model, transform)

**Analog:** `src/pipeline/contracts.ts`

**Contract union pattern** (`src/pipeline/contracts.ts:1-27`):
```ts
export type PlanMode = 'ticket' | 'no_ticket' | 'invalid_ticket_soft_fail';

export interface TicketPlanCommand {
  mode: 'ticket';
  ticketId: string;
  userContext: string;
  warnings: string[];
  normalizedInput: string;
}

export type PlanParseResult = TicketPlanCommand | NoTicketPlanCommand | InvalidTicketSoftFailCommand;
```

**Metadata/timestamp contract fields** (`src/pipeline/contracts.ts:33-41`):
```ts
export interface RequestContext {
  requestId: string;
  mode: PlanMode;
  ticketId?: string;
  userContext?: UserInputContext;
  warnings: string[];
  createdAt: string;
  stage: 'context_bootstrapped';
}
```

**Enum-like literal pattern for gates/states** (`src/pipeline/confidence/confidenceContracts.ts:1-21`):
```ts
export type ConfidenceGate = 'reject' | 'approval_required' | 'continue';

export interface ConfidenceThresholdPolicy {
  rejectBelow: number;
  approvalMin: number;
  approvalMax: number;
  continueAbove: number;
}
```

---

### `src/pipeline/planning/scenarioMapper.ts` (service, batch)

**Analog:** `src/pipeline/context/jiraContextBuilder.ts`

**Import and typed dependency injection pattern** (`src/pipeline/context/jiraContextBuilder.ts:1-40`):
```ts
import type {
  JiraClient,
  JiraCompleteness,
  JiraTicketGraphPayload
} from '../../adapters/jiraClient';

export interface JiraContextBuildInput {
  client: JiraClient;
  ticketId: string;
  requestId: string;
  traversalLimits?: Partial<JiraTraversalLimits>;
  stageBudgetMs?: number;
}
```

**Core batch mapping loop pattern** (`src/pipeline/context/jiraContextBuilder.ts:248-307`):
```ts
while (queue.length > 0) {
  if (Object.keys(issueGraphByKey).length >= limits.maxIssues) {
    completenessReasons.add('cap_reached');
    break;
  }

  const currentTicketId = queue.shift();
  if (!currentTicketId) {
    continue;
  }

  const fetchResult = await fetchTicketWithRetry(...);
  if (!fetchResult.payload) {
    completenessReasons.add(fetchResult.timedOut ? 'timeout' : 'fetch_failed');
    if (fetchResult.timedOut) {
      break;
    }
    continue;
  }

  issueGraphByKey[currentTicketId] = fetchResult.payload;
}
```

**Error/fallback pattern** (`src/pipeline/context/jiraContextBuilder.ts:282-288,310-312`):
```ts
if (!fetchResult.payload) {
  completenessReasons.add(fetchResult.timedOut ? 'timeout' : 'fetch_failed');
  ...
}

const root = issueGraphByKey[input.ticketId] ?? createFallbackPayload(input.ticketId);
mergeCompletenessReasons(completenessReasons, root);
```

---

### `src/pipeline/planning/scenarioGrouping.ts` (utility, transform)

**Analog:** `src/pipeline/context/confluenceQueryBuilder.ts`

**Deterministic dedupe helper pattern** (`src/pipeline/context/confluenceQueryBuilder.ts:43-68`):
```ts
function appendQuery(
  target: ConfluenceQuery[],
  seen: Set<string>,
  queryText: string,
  sourceEntity: string,
  priority: number,
  maxResults: number
): void {
  const normalized = queryText.trim();
  if (!normalized) {
    return;
  }

  const key = `${sourceEntity}::${normalized.toLowerCase()}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  target.push({ queryText: normalized, sourceEntity, priority, maxResults });
}
```

**Keyword normalization pattern** (`src/pipeline/context/confluenceQueryBuilder.ts:32-41`):
```ts
const tokens = text
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .map((token) => token.trim())
  .filter((token) => token.length >= 4 && !KEYWORD_STOPWORDS.has(token));
```

**Stable sort + slice pattern** (`src/pipeline/context/confluenceQueryBuilder.ts:125-127`):
```ts
return queries
  .sort((a, b) => b.priority - a.priority || a.queryText.localeCompare(b.queryText))
  .slice(0, maxQueries);
```

---

### `src/pipeline/planning/approvalScope.ts` (utility, transform)

**Analog:** `src/pipeline/context/confluenceContextBuilder.ts`

**Scope filtering pattern** (`src/pipeline/context/confluenceContextBuilder.ts:78-82`):
```ts
const bonusCandidates = scoredPages.filter((page) => page.bucket === 'high');
const scoringContribution = [...bonusCandidates];
const visibleOnly = scoredPages.filter((page) => page.bucket === 'mid');
const excludedLow = scoredPages.filter((page) => page.bucket === 'low');
```

**Derived counters and return contract pattern** (`src/pipeline/context/confluenceContextBuilder.ts:83-97`):
```ts
const bonusContributionPotential = scoringContribution.reduce((total, candidate) => total + candidate.score, 0);

return {
  requestId: jiraContext.requestId,
  highCount: bonusCandidates.length,
  midCount: visibleOnly.length,
  excludedLowCount: excludedLow.length,
  bonusContributionPotential,
  augmentationOnly: true
};
```

**Data sanitization before scope usage** (`src/pipeline/context/confluenceContextBuilder.ts:38-55`):
```ts
function sanitizeSnippet(snippet: string | undefined, maxLength = 280): string | undefined {
  if (!snippet) {
    return snippet;
  }
  const squashed = snippet.replace(/\s+/g, ' ').trim();
  return squashed.length <= maxLength ? squashed : `${squashed.slice(0, maxLength)}...`;
}
```

---

### `src/pipeline/orchestrator.ts` (service, event-driven)

**Analog:** `src/pipeline/orchestrator.ts`

**Session store + deps pattern** (`src/pipeline/orchestrator.ts:31-41,43-56`):
```ts
export class PipelineOrchestrator {
  private readonly sessions = new Map<string, PipelineSession>();
  private readonly eventSink: EventSink;
  private readonly now: () => Date;

  startSession(requestId: string, initialState: PipelineState = 'initialized'): PipelineSession {
    const timestamp = this.now().toISOString();
    const session: PipelineSession = { ... };
    this.sessions.set(requestId, session);
    this.emit(requestId, 'orchestrator', 'session_started', initialState);
    return session;
  }
}
```

**Guarded transition pattern** (`src/pipeline/orchestrator.ts:114-127,130-145`):
```ts
const transition = transitionState(session.state, to);
if (!transition.ok) {
  this.emit(requestId, 'gate', 'transition_blocked', session.state, {
    attempted: to,
    action,
    errorCode: transition.errorCode
  });
  return { ok: false, requestId, from: session.state, errorCode: transition.errorCode };
}

session.state = to;
return { ok: true, requestId, from: transition.from, to: transition.to };
```

**Action normalization pattern** (`src/pipeline/orchestrator.ts:158-197`):
```ts
let targetState: PipelineState | undefined;
if (action === 'cancel') {
  targetState = 'cancelled';
} else if (action === 'approve') {
  ...
}
if (!targetState) {
  this.emit(requestId, 'gate', 'quick_action_unmapped', session.state, { action });
  return { ok: false, requestId, from: session.state, errorCode: 'UNMAPPED_ACTION' };
}
return this.transition(requestId, targetState, action);
```

---

### `src/pipeline/stateMachine.ts` (utility, event-driven)

**Analog:** `src/pipeline/stateMachine.ts`

**Literal transition graph pattern** (`src/pipeline/stateMachine.ts:20-31`):
```ts
export const ALLOWED_TRANSITIONS: Readonly<Record<PipelineState, readonly PipelineState[]>> = {
  initialized: ['awaiting_plan_approval', 'cancelled'],
  awaiting_plan_approval: ['plan_approved', 'plan_rejected', 'cancelled'],
  ...
  completed: [],
  cancelled: []
};
```

**Single gatekeeper function pattern** (`src/pipeline/stateMachine.ts:37-52`):
```ts
export function transitionState(from: PipelineState, to: PipelineState): TransitionResult {
  if (!canTransition(from, to)) {
    return { ok: false, from, to, errorCode: 'ILLEGAL_TRANSITION' };
  }
  return { ok: true, from, to };
}
```

---

### `src/participant/handler.ts` (controller, request-response)

**Analog:** `src/participant/handler.ts`

**Imports and dependency injection pattern** (`src/participant/handler.ts:1-20,65-72`):
```ts
import type { EventSink, PipelineEvent } from '../adapters/eventSink';
import { InMemoryEventSink } from '../adapters/eventSink';
import { parseSlashPlanInput } from './slashPlanParser';
import { QUICK_ACTIONS, type QuickAction } from './actions';

export interface ParticipantHandlerDeps {
  eventSink?: EventSink;
  requestIdFactory?: () => string;
  now?: () => Date;
  orchestrator?: PipelineOrchestrator;
}
```

**Response contract builder pattern** (`src/participant/handler.ts:187-213`):
```ts
function buildResponse(...): PlanCommandResponse {
  return {
    requestId,
    mode,
    state,
    message: toMessage(mode, decision.gate),
    availableActions: CONFIDENCE_GATE_ACTIONS[decision.gate],
    confidenceScore: decision.finalScore,
    decisionGate: decision.gate,
    acceptsFreeText: decision.gate === 'approval_required'
  };
}
```

**Free-text normalize + recompute flow** (`src/participant/handler.ts:305-337,347-364`):
```ts
const trimmed = freeText.trim();
if (!trimmed) {
  ...
}

snapshot.userContextParts.push(trimmed);
emitEvent(eventSink, requestId, 'gate', 'free_text_received', now, { freeTextLength: trimmed.length });
deps.orchestrator?.appendFreeTextContext(requestId, trimmed);
...
emitEvent(eventSink, requestId, 'gate', 'confidence_recomputed_from_free_text', now, { ... });
deps.orchestrator.setConfidenceDecision(requestId, decision.profileId, decision.gate);
```

**Error handling pattern** (`src/participant/handler.ts:297-300`):
```ts
const snapshot = REQUEST_SNAPSHOTS.get(requestId);
if (!snapshot) {
  throw new Error(`Unknown requestId: ${requestId}`);
}
```

---

### `src/ui/planReviewShell.ts` (component, request-response)

**Analog:** `src/ui/planReviewShell.ts`

**Payload contract pattern** (`src/ui/planReviewShell.ts:4-9`):
```ts
export interface PlanReviewShellPayload {
  requestId: string;
  state: PipelineState;
  summary: string;
  actions: readonly QuickAction[];
}
```

**UI safety sanitization pattern** (`src/ui/planReviewShell.ts:11-18`):
```ts
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
```

**Render + action control pattern** (`src/ui/planReviewShell.ts:20-33`):
```ts
const actions = payload.actions
  .map((action) => `<button data-action="${action}">${action}</button>`)
  .join('');

return [
  '<section class="plan-review-shell">',
  `  <p data-request-id="${escapeHtml(payload.requestId)}">Request: ${escapeHtml(payload.requestId)}</p>`,
  `  <div data-actions>${actions}</div>`,
  '</section>'
].join('\n');
```

---

### `src/ui/reviewModel.ts` (model, transform)

**Analog:** `src/pipeline/confidence/explainability.ts`

**Nested view-model shape pattern** (`src/pipeline/confidence/explainability.ts:12-21`):
```ts
export interface ConfidenceExplainability {
  profileId: string;
  profileVersion: string;
  gate: ConfidenceDecision['gate'];
  finalScore: number;
  componentScores: ConfidenceDecision['componentScores'];
  thresholdComparisons: ConfidenceThresholdComparison[];
  evidence: ConfidenceEvidenceRef[];
  reasons: string[];
}
```

**Sanitization before presenting model pattern** (`src/pipeline/confidence/explainability.ts:52-60,88-90`):
```ts
function sanitizeEvidenceReference(reference: ConfidenceEvidenceRef): ConfidenceEvidenceRef {
  return {
    source: reference.source,
    ...
    snippet: sanitizeSnippet(reference.snippet),
    metadata: sanitizeMetadata(reference.metadata)
  };
}
...
evidence: (input.evidence ?? []).map(sanitizeEvidenceReference),
reasons: input.reasons ?? []
```

---

### `src/ui/reviewActions.ts` (utility, event-driven)

**Analog:** `src/participant/actions.ts`

**Action vocabulary as readonly tuple pattern** (`src/participant/actions.ts:1-7`):
```ts
export const QUICK_ACTIONS = ['approve', 'reject', 'continue', 'cancel'] as const;

export type QuickAction = (typeof QUICK_ACTIONS)[number];

export function isQuickAction(value: string): value is QuickAction {
  return (QUICK_ACTIONS as readonly string[]).includes(value);
}
```

**Dispatch mapping pattern** (`src/pipeline/orchestrator.ts:160-182`):
```ts
if (action === 'cancel') {
  targetState = 'cancelled';
} else if (action === 'approve') {
  ...
} else if (action === 'continue') {
  ...
}
```

---

### `tests/integration/confidence-gate-flow.test.ts` (test, event-driven, reference-only)

**Analog:** `tests/integration/confidence-gate-flow.test.ts`

**Integration harness pattern** (`tests/integration/confidence-gate-flow.test.ts:21-37`):
```ts
describe('confidence gate flow', () => {
  it('reject under 40', () => {
    const sink = new InMemoryEventSink();
    const orchestrator = new PipelineOrchestrator({ eventSink: sink });
    const response = handlePlanCommand('/plan QA-300', { ... });
    expect(response.decisionGate).toBe('reject');
  });
});
```

**Revision/recompute assertion pattern** (`tests/integration/confidence-gate-flow.test.ts:56-72`):
```ts
const recomputed = handleGateFreeText(response.requestId, 'Add explicit acceptance criteria and selectors', { ... });
expect(recomputed.decisionGate).toBe('continue');
expect(recomputed.state).toBe('plan_approved');

const actions = sink.getEvents().map((event) => event.action);
expect(actions).toContain('free_text_received');
expect(actions).toContain('confidence_recomputed_from_free_text');
```

---

### `tests/integration/request-correlation.test.ts` (test, event-driven)

**Analog:** `tests/integration/request-correlation.test.ts`

**RequestId correlation pattern** (`tests/integration/request-correlation.test.ts:16-44`):
```ts
const response = handlePlanCommand('/plan QA-77 add checkout retries', { ... });
expect(response.requestId).toBe('req_corr_1');

const events = sink.getEvents();
expect(events.every((event) => event.requestId === 'req_corr_1')).toBe(true);
```

**State mutation guard assertion pattern** (`tests/integration/request-correlation.test.ts:46-66`):
```ts
const result = orchestrator.handleQuickAction(response.requestId, 'approve');
const session = orchestrator.getSession(response.requestId);

expect(result.ok).toBe(false);
expect(result.errorCode).toBe('UNMAPPED_ACTION');
expect(session?.state).toBe('plan_approved');
```

---

### `tests/smoke/webview-shell.test.ts` (test, request-response)

**Analog:** `tests/smoke/webview-shell.test.ts`

**Render contract smoke pattern** (`tests/smoke/webview-shell.test.ts:6-22`):
```ts
const html = renderPlanReviewShell({
  requestId: 'req_ui_1',
  state: 'awaiting_plan_approval',
  summary: '3 scenarios mapped to AC-1, AC-2, AC-3',
  actions: ['approve', 'reject', 'continue', 'cancel']
});

expect(html).toContain('data-action="approve"');
```

**Shell state retention pattern** (`tests/smoke/webview-shell.test.ts:24-38`):
```ts
const shell = new PlanReviewShell();
shell.open({ ... });
expect(shell.getLastPayload()).toMatchObject({
  requestId: 'req_ui_2',
  state: 'ready_to_write'
});
```

---

### `tests/unit/pipeline-state-machine.test.ts` (test, event-driven, reference-only)

**Analog:** `tests/unit/pipeline-state-machine.test.ts`

**Unit transition legality pattern** (`tests/unit/pipeline-state-machine.test.ts:6-20`):
```ts
expect(canTransition('initialized', 'awaiting_plan_approval')).toBe(true);
expect(transitionState('awaiting_plan_approval', 'plan_approved')).toMatchObject({ ok: true });

const result = transitionState('initialized', 'ready_to_write');
expect(result.ok).toBe(false);
expect(result.errorCode).toBe('ILLEGAL_TRANSITION');
```

---

## Shared Patterns

### Request-Scoped Event Correlation
**Source:** `src/participant/handler.ts:225-237`, `src/pipeline/orchestrator.ts:208-222`, `src/pipeline/events.ts:26-40`  
**Apply to:** `orchestrator.ts`, `handler.ts`, `reviewActions.ts`, integration tests
```ts
emitEvent(eventSink, requestContext.requestId, 'participant', 'command_received', now, {...});
...
const event = createPipelineEvent({ requestId, stage, action, state, details }, this.now);
this.eventSink.emit(event);
```

### Guarded State Transitions
**Source:** `src/pipeline/stateMachine.ts:20-52`, `src/pipeline/orchestrator.ts:114-127`  
**Apply to:** scenario approval lifecycle (`pending|approved|rejected|needs_revision`) and bulk actions
```ts
if (!canTransition(from, to)) {
  return { ok: false, from, to, errorCode: 'ILLEGAL_TRANSITION' };
}
```

### Action Vocabulary Normalization
**Source:** `src/participant/actions.ts:1-7`, `src/pipeline/orchestrator.ts:158-197`  
**Apply to:** chat + webview action dispatch envelopes
```ts
export const QUICK_ACTIONS = ['approve', 'reject', 'continue', 'cancel'] as const;
...
if (!targetState) {
  return { ok: false, requestId, from: session.state, errorCode: 'UNMAPPED_ACTION' };
}
```

### Input Sanitization Before Render/Storage
**Source:** `src/ui/planReviewShell.ts:11-18`, `src/pipeline/confidence/explainability.ts:30-35`  
**Apply to:** scenario comments, risk reasons, assertion summaries rendered in webview/chat
```ts
replaceAll('&', '&amp;').replaceAll('<', '&lt;')
...
.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
```

### Deterministic Grouping and Filtering
**Source:** `src/pipeline/context/confluenceQueryBuilder.ts:43-68,125-127`, `src/pipeline/context/confluenceContextBuilder.ts:78-97`  
**Apply to:** requirement/AC/functionality group indexes and rejected tab projections
```ts
if (seen.has(key)) return;
...
return queries.sort(...).slice(0, maxQueries);
```

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/ui/reviewApp.tsx` | component | event-driven | No React/MUI component implementation exists in repo yet; current UI is HTML string renderer (`src/ui/planReviewShell.ts`). |

## Metadata

**Analog search scope:** `src/pipeline/**`, `src/participant/**`, `src/ui/**`, `tests/integration/**`, `tests/unit/**`, `tests/smoke/**`  
**Files scanned:** 20  
**Pattern extraction date:** 2026-05-30
