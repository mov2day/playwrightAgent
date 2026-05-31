# Phase 5: Execution, Retry Loop, and Audit Logging - Pattern Map

**Mapped:** 2026-05-31  
**Files analyzed:** 14  
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pipeline/execution/contracts.ts` | model | transform | `src/pipeline/writer/writeContracts.ts` | role-match |
| `src/pipeline/execution/scopedRunExecutor.ts` | service | request-response | `src/pipeline/guardrails/lintTypeRunner.ts` | exact |
| `src/pipeline/execution/failureClassifier.ts` | utility | transform | `src/pipeline/context/confluenceRelevance.ts` | partial |
| `src/pipeline/execution/reportSummarizer.ts` | utility | transform | `src/pipeline/writer/writeReport.ts` | exact |
| `src/adapters/auditFileSink.ts` | service | file-I/O | `src/pipeline/writer/surgicalWriter.ts` | partial |
| `src/adapters/eventSink.ts` (modify) | adapter | event-driven | `src/adapters/eventSink.ts` | exact |
| `src/pipeline/events.ts` (modify) | model | event-driven | `src/pipeline/events.ts` | exact |
| `src/pipeline/orchestrator.ts` (modify) | controller | event-driven | `src/pipeline/orchestrator.ts` | exact |
| `src/participant/handler.ts` (modify) | controller | request-response | `src/participant/handler.ts` | exact |
| `tests/integration/execution-run-flow.test.ts` | test | request-response | `tests/integration/generation-preview-write-flow.test.ts` | role-match |
| `tests/integration/execution-classification-reporting.test.ts` | test | transform | `tests/integration/plan-chat-summary.test.ts` | partial |
| `tests/integration/execution-retry-escalation.test.ts` | test | event-driven | `tests/integration/lint-type-escalation-flow.test.ts` | exact |
| `tests/integration/audit-persistence-request-correlation.test.ts` | test | event-driven | `tests/integration/request-correlation.test.ts` | exact |
| `tests/integration/audit-redaction-persistence.test.ts` | test | file-I/O | `tests/unit/jira-client.test.ts` | role-match |

## Pattern Assignments

### `src/pipeline/execution/contracts.ts` (model, transform)

**Analog:** `src/pipeline/writer/writeContracts.ts`

**Imports + literal union contract style** (`src/pipeline/writer/writeContracts.ts:1-13`)
```typescript
import type { SpecPlacementMode } from '../generation/specPlacement';

export const WRITER_MODES = ['patch_existing', 'create_scoped', 'skip'] as const;

export type WriterMode = SpecPlacementMode | 'skip';
...
export type WriteOutcomeStatus = 'patched' | 'created' | 'skipped';
```

**Normalized constructor pattern for contract inputs** (`src/pipeline/writer/writeContracts.ts:44-57`)
```typescript
export function createWritePlanEntry(input: WritePlanEntryInput): WritePlanEntry {
  const scenarioIds = [...new Set(input.scenarioIds.map((scenarioId) => scenarioId.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));

  return {
    targetPath: input.targetPath.trim(),
    mode: input.mode,
    scenarioIds,
    generatedBlock: input.generatedBlock,
    describeName: input.describeName?.trim() || undefined,
    markerBegin: input.markerBegin?.trim() || undefined,
    markerEnd: input.markerEnd?.trim() || undefined
  };
}
```

---

### `src/pipeline/execution/scopedRunExecutor.ts` (service, request-response)

**Analog:** `src/pipeline/guardrails/lintTypeRunner.ts`

**Import layering and command-runner dependency injection** (`src/pipeline/guardrails/lintTypeRunner.ts:1-5`, `:37-43`, `:72-77`)
```typescript
import {
  redactSensitiveText,
  runLocalToolCommand,
  type LocalToolCommandResult
} from '../../adapters/localToolRunner';
...
export interface LintTypeRunnerDeps {
  commandRunner?: (
    command: string,
    args: string[]
  ) => Promise<LocalToolCommandResult>;
  now?: () => Date;
}
...
const commandRunner = deps.commandRunner ?? runLocalToolCommand;
const now = deps.now ?? (() => new Date());
```

**Deterministic stage loop and early fail return** (`src/pipeline/guardrails/lintTypeRunner.ts:79-99`)
```typescript
for (const spec of DEFAULT_GUARDRAIL_COMMANDS) {
  const startedAt = now();
  const commandResult = await commandRunner(spec.command, spec.args);
  const completedAt = now();
  const sanitizedResult = sanitizeCommandResult(commandResult, spec.command, spec.args);
  ...
  if (!sanitizedResult.ok) {
    return {
      status: 'failed_needs_retry',
      stageResults,
      failedStage: spec.stage
    };
  }
}
```

**Sanitize before returning payload** (`src/pipeline/guardrails/lintTypeRunner.ts:53-70`)
```typescript
function sanitizeCommandResult(
  result: LocalToolCommandResult,
  command: string,
  args: string[]
): LocalToolCommandResult {
  const stdout = clampOutput(redactSensitiveText(result.stdout ?? ''));
  const stderr = clampOutput(redactSensitiveText(result.stderr ?? ''));
  ...
}
```

---

### `src/pipeline/execution/failureClassifier.ts` (utility, transform)

**Analog:** `src/pipeline/context/confluenceRelevance.ts`

**Bucket classification helper style** (`src/pipeline/context/confluenceRelevance.ts:175-183`)
```typescript
function classifyBucket(score: number, weights: ConfluenceRelevanceWeights): ConfluenceRelevanceBucket {
  if (score >= weights.highThreshold) {
    return 'high';
  }
  if (score >= weights.midThreshold) {
    return 'mid';
  }
  return 'low';
}
```

**Component-score + weighted-output pattern** (`src/pipeline/context/confluenceRelevance.ts:236-255`)
```typescript
const componentScores: ConfluenceComponentScores = {
  lexical: overlapScore(pageTokens, signals.jiraTokens),
  semantic: semanticScore(pageTokens, signals.jiraTokens),
  jiraLinkProximity: linkProximityScore(page, signals),
  freshness: freshnessScore(page, now, weights.freshnessHorizonDays)
};
...
const score = clamp01(weightedScore);
const bucket = classifyBucket(score, weights);
```

Use this pattern for required Phase 5 buckets:
- `test_authoring`
- `application_behavior`
- `environment_or_tooling`

---

### `src/pipeline/execution/reportSummarizer.ts` (utility, transform)

**Analog:** `src/pipeline/writer/writeReport.ts`

**Reducer-based summary aggregation** (`src/pipeline/writer/writeReport.ts:18-37`)
```typescript
function summarizeOutcomes(outcomes: readonly WriteOutcome[]): WriteReportSummary {
  return outcomes.reduce<WriteReportSummary>((summary, outcome) => {
    summary.total += 1;
    ...
    return summary;
  }, {
    total: 0,
    patched: 0,
    created: 0,
    skipped: 0
  });
}
```

**Report builder function shape** (`src/pipeline/writer/writeReport.ts:50-62`)
```typescript
export function buildWriteReportSummary(
  requestId: string,
  previewVersion: string,
  outcomes: readonly WriteOutcome[]
): WriteReport {
  return {
    requestId,
    previewVersion,
    summary: summarizeOutcomes(outcomes),
    outcomes: outcomes.map((outcome) => ({ ...outcome })),
    skippedReasons: summarizeSkippedReasons(outcomes)
  };
}
```

---

### `src/adapters/auditFileSink.ts` (service, file-I/O)

**Primary analog:** `src/pipeline/writer/surgicalWriter.ts`  
**Secondary analog:** `src/adapters/eventSink.ts`

**Filesystem-safe write steps** (`src/pipeline/writer/surgicalWriter.ts:42-44`, `:177-190`)
```typescript
function ensureParentDirectory(absolutePath: string): void {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
}
...
ensureParentDirectory(absolutePath);
const existing = readExistingContent(absolutePath);
...
const next = appendGeneratedBlock(existing, generatedBlock);
fs.writeFileSync(absolutePath, next, 'utf8');
```

**Event sink interface contract to implement** (`src/adapters/eventSink.ts:11-13`)
```typescript
export interface EventSink {
  emit(event: PipelineEvent): void;
}
```

**Redaction before persistence** (`src/adapters/localToolRunner.ts:24-29`)
```typescript
export function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret)\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]');
}
```

---

### `src/adapters/eventSink.ts` (modify, adapter, event-driven)

**Analog:** `src/adapters/eventSink.ts`

**Baseline sink abstraction + in-memory implementation** (`src/adapters/eventSink.ts:1-29`)
```typescript
export interface PipelineEvent {
  requestId: string;
  stage: string;
  action: string;
  timestamp: string;
  confidenceProfileId?: string;
  decisionGate?: 'reject' | 'approval_required' | 'continue';
  details?: Record<string, unknown>;
}

export interface EventSink {
  emit(event: PipelineEvent): void;
}

export class InMemoryEventSink implements EventSink { ... }
```

Use this same interface-first pattern for dual sink fan-out (memory + file).

---

### `src/pipeline/events.ts` (modify, model, event-driven)

**Analog:** `src/pipeline/events.ts`

**Canonical event envelope pattern** (`src/pipeline/events.ts:3-14`)
```typescript
export type PipelineStage = 'participant' | 'parser' | 'bootstrap' | 'orchestrator' | 'gate' | 'ui';

export interface PipelineStageEvent {
  requestId: string;
  stage: PipelineStage;
  action: string;
  state?: PipelineState;
  confidenceProfileId?: string;
  decisionGate?: 'reject' | 'approval_required' | 'continue';
  timestamp: string;
  details?: Record<string, unknown>;
}
```

**Factory pattern with injected clock** (`src/pipeline/events.ts:26-39`)
```typescript
export function createPipelineEvent(
  input: CreatePipelineEventInput,
  now: () => Date = () => new Date()
): PipelineStageEvent {
  return {
    requestId: input.requestId,
    ...
    timestamp: now().toISOString(),
    details: input.details
  };
}
```

---

### `src/pipeline/orchestrator.ts` (modify, controller, event-driven)

**Analog:** `src/pipeline/orchestrator.ts`

**Scoped target derivation + fixed retry cap integration** (`src/pipeline/orchestrator.ts:892-913`)
```typescript
const targetFiles = normalizeTargetFiles(
  options.targetFiles ?? writeResult.outcomes
    .filter((outcome) => outcome.status === 'patched' || outcome.status === 'created')
    .map((outcome) => outcome.targetPath)
);
...
const guardrail = await resolveLintTypeRetryEscalation({
  requestId,
  initialGuardrailResult,
  targetFiles,
  maxAttempts: 1,
  ...
});
```

**Escalation transition + structured payload emit** (`src/pipeline/orchestrator.ts:915-955`)
```typescript
if (guardrail.status === 'escalated') {
  const blockedTransition = transitionState(session.state, 'awaiting_guardrail_decision');
  ...
  this.emit(requestId, 'gate', 'guardrail_escalation_required', session.state, {
    guardrail_failed: true,
    blocked_state: session.state,
    command: guardrail.escalation?.command,
    topErrors: guardrail.escalation?.topErrors,
    affectedFiles: guardrail.escalation?.affectedFiles,
    attemptedFixSummary: guardrail.escalation?.attemptedFixSummary,
    suggestedActions: guardrail.escalation?.suggestedActions
  }, session.confidenceProfileId, session.decisionGate);
  ...
}
```

**Centralized emit wrapper using canonical event factory** (`src/pipeline/orchestrator.ts:1257-1280`)
```typescript
private emit(...): void {
  const event = createPipelineEvent(
    {
      requestId,
      stage,
      action,
      state,
      confidenceProfileId,
      decisionGate,
      details
    },
    this.now
  );

  this.eventSink.emit(event);
}
```

---

### `src/participant/handler.ts` (modify, controller, request-response)

**Analog:** `src/participant/handler.ts`

**Participant-level event emission helper** (`src/participant/handler.ts:100-120`)
```typescript
function emitEvent(
  sink: EventSink,
  requestId: string,
  stage: string,
  action: string,
  now: () => Date,
  details?: Record<string, unknown>,
  confidenceProfileId?: string,
  decisionGate?: ConfidenceGate
): void {
  const event: PipelineEvent = {
    requestId,
    stage,
    action,
    timestamp: now().toISOString(),
    confidenceProfileId,
    decisionGate,
    details
  };
  sink.emit(event);
}
```

**Quick action delegation pattern** (`src/participant/handler.ts:586-629`)
```typescript
export function handlePreviewApproveAll(...): ActionTransitionResult { ... }

export function handleGuardrailDecision(
  requestId: string,
  action: QuickAction,
  comment: string | undefined,
  deps: ParticipantHandlerDeps = {}
): ActionTransitionResult {
  const orchestrator = deps.orchestrator;
  if (!orchestrator) {
    return { ok: false, requestId, from: 'initialized', errorCode: 'UNKNOWN_REQUEST' };
  }

  return orchestrator.applyGuardrailDecision(requestId, action, comment);
}
```

---

### `tests/integration/execution-run-flow.test.ts` (test, request-response)

**Analog:** `tests/integration/generation-preview-write-flow.test.ts`

**Temp workspace fixture pattern** (`tests/integration/generation-preview-write-flow.test.ts:14-37`)
```typescript
const TEMP_DIRS: string[] = [];

function makeTempWriteRoot(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwagent-writer-'));
  TEMP_DIRS.push(rootDir);
  return rootDir;
}

afterEach(() => {
  for (const tempDir of TEMP_DIRS) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  TEMP_DIRS.length = 0;
});
```

**End-to-end gate flow assertion style** (`tests/integration/generation-preview-write-flow.test.ts:69-114`)
```typescript
const response = handlePlanCommand(...);
expect(orchestrator.handleQuickAction(response.requestId, 'approve').ok).toBe(true);
...
const blockedContinue = orchestrator.handleQuickAction(response.requestId, 'continue');
expect(blockedContinue.errorCode).toBe('PREVIEW_APPROVAL_REQUIRED');
...
expect(orchestrator.getSession(response.requestId)?.state).toBe('ready_to_write');
```

---

### `tests/integration/execution-classification-reporting.test.ts` (test, transform)

**Primary analog:** `tests/integration/plan-chat-summary.test.ts`  
**Secondary analog:** `tests/integration/lint-type-escalation-flow.test.ts`

**Summary-first assertions pattern** (`tests/integration/plan-chat-summary.test.ts:31-45`)
```typescript
expect(response.planSummary).toContain('## Scenario Review Plan');
...
expect(response.planScenarios?.[0]).toMatchObject({
  scenarioName: 'Checkout success path',
  primaryRequirementId: 'PLAN-01',
  acceptanceCriteriaIds: ['AC-1', 'AC-2'],
  assertionIntentSummary: 'Confirm user can complete purchase with valid card.'
});
```

**Structured diagnostics assertion style** (`tests/integration/lint-type-escalation-flow.test.ts:256-270`)
```typescript
expect(outcome.status).toBe('escalated');
...
expect(outcome.escalation).toMatchObject({
  command: 'npm run typecheck',
  affectedFiles: ['tests/e2e/auth.spec.ts', 'tests/e2e/checkout.spec.ts']
});
expect(outcome.escalation?.topErrors.length).toBeGreaterThan(0);
```

---

### `tests/integration/execution-retry-escalation.test.ts` (test, event-driven)

**Analog:** `tests/integration/lint-type-escalation-flow.test.ts`

**One-shot retry contract assertion** (`tests/integration/lint-type-escalation-flow.test.ts:117-174`)
```typescript
const outcome = await resolveLintTypeRetryEscalation({ ... });

expect(outcome.status).toBe('passed_after_retry');
expect(outcome.retry.attempts).toBe(1);
expect(outcome.retry.maxAttempts).toBe(1);
expect(outcome.retry.targetFiles).toEqual(['tests/e2e/auth.spec.ts', 'tests/e2e/cart.spec.ts']);
```

**Blocked state requires explicit decision** (`tests/integration/lint-type-escalation-flow.test.ts:320-342`)
```typescript
expect(result.errorCode).toBe('GUARDRAIL_ESCALATION_REQUIRED');
expect(result.to).toBe('awaiting_guardrail_decision');
expect(orchestrator.getSession(requestId)?.state).toBe('awaiting_guardrail_decision');
...
expect(continueResult.to).toBe('ready_to_write');
```

**Allowlist enforcement for decisions** (`tests/integration/lint-type-escalation-flow.test.ts:396-412`)
```typescript
const invalid = orchestrator.applyGuardrailDecision(requestId, 'retry' as ..., 'retry not allowed');
expect(invalid.errorCode).toBe('UNMAPPED_ACTION');
...
const rejectResult = handleGuardrailDecision(requestId, 'reject', ...);
expect(rejectResult.to).toBe('cancelled');
```

---

### `tests/integration/audit-persistence-request-correlation.test.ts` (test, event-driven)

**Analog:** `tests/integration/request-correlation.test.ts`

**RequestId propagation flow** (`tests/integration/request-correlation.test.ts:16-39`)
```typescript
const response = handlePlanCommand(... requestIdFactory: () => 'req_corr_1' ...);
...
const approvePlan = orchestrator.handleQuickAction(response.requestId, 'approve');
...
const continueToWrite = orchestrator.handleQuickAction(response.requestId, 'continue');
```

**Event stream correlation assertions** (`tests/integration/request-correlation.test.ts:54-65`)
```typescript
const events = sink.getEvents();
expect(events.length).toBeGreaterThanOrEqual(8);
expect(events.every((event) => event.requestId === 'req_corr_1')).toBe(true);
...
const reviewEvents = events.filter((event) => event.action === 'review_action_applied');
expect(reviewEvents).toHaveLength(1);
```

---

### `tests/integration/audit-redaction-persistence.test.ts` (test, file-I/O)

**Primary analog:** `tests/unit/jira-client.test.ts`  
**Secondary analog:** `src/adapters/localToolRunner.ts`

**Leak-proof expectation pattern** (`tests/unit/jira-client.test.ts:6-27`)
```typescript
await expect(
  client.fetchTicketGraph({ ticketId: 'QA-123', requestId: 'req_jira_1' })
).rejects.toThrow(/\[REDACTED\]/);

await expect(
  client.fetchTicketGraph({ ticketId: 'QA-123', requestId: 'req_jira_1' })
).rejects.not.toThrow(/abc123|my-super-secret|token=xyz/);
```

**Regex redaction source of truth** (`src/adapters/localToolRunner.ts:24-29`)
```typescript
export function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret)\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]');
}
```

## Shared Patterns

### Request Correlation Everywhere
**Sources:** `src/pipeline/events.ts`, `src/pipeline/orchestrator.ts`, `tests/integration/request-correlation.test.ts`  
**Apply to:** execution services, audit sink, participant run trigger, all phase-5 tests
```typescript
export interface PipelineStageEvent {
  requestId: string;
  stage: PipelineStage;
  action: string;
  ...
}
```
```typescript
const event = createPipelineEvent({ requestId, stage, action, ... }, this.now);
this.eventSink.emit(event);
```

### Guardrail Decision Allowlist
**Sources:** `src/participant/actions.ts`, `src/pipeline/orchestrator.ts`  
**Apply to:** one-shot execution retry escalation path
```typescript
export const QUICK_ACTIONS = ['approve', 'reject', 'continue', 'cancel'] as const;
```
```typescript
if (action === 'approve') {
  targetState = 'completed';
} else if (action === 'continue') {
  targetState = 'ready_to_write';
} else if (action === 'reject' || action === 'cancel') {
  targetState = 'cancelled';
}
```

### Redact Before Any Durable Write
**Sources:** `src/adapters/localToolRunner.ts`, `src/adapters/jiraClient.ts`  
**Apply to:** audit file sink persistence and run output storage
```typescript
const errorText = redactSensitiveText(result.error ?? result.stderr ?? 'Unknown ...');
throw new Error(`...: ${errorText}`);
```

### Deterministic Scoped Retry and Target Normalization
**Sources:** `src/pipeline/guardrails/retryEscalation.ts`, `src/pipeline/orchestrator.ts`  
**Apply to:** phase-5 run retry loop
```typescript
const scopedTargetFiles = [...new Set(targetFiles.map(...).filter(Boolean))]
  .sort((left, right) => left.localeCompare(right));
...
maxAttempts: 1
```

### Integration Test Harness Style
**Sources:** `tests/integration/lint-type-escalation-flow.test.ts`, `tests/integration/generation-preview-write-flow.test.ts`  
**Apply to:** all new phase-5 integration tests
```typescript
const sink = new InMemoryEventSink();
const orchestrator = new PipelineOrchestrator({ eventSink: sink, now, rootDir, stageEntryGateEvaluator: ... });
...
expect(result.errorCode).toBe('GUARDRAIL_ESCALATION_REQUIRED');
```

## No Analog Found

None. Every target has at least a role-match analog; partial matches are flagged in File Classification.

## Metadata

**Analog search scope:** `src/adapters`, `src/pipeline`, `src/participant`, `tests/integration`, `tests/unit`  
**Files scanned:** 77  
**Pattern extraction date:** 2026-05-31
