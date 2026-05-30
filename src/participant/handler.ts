import type { EventSink, PipelineEvent } from '../adapters/eventSink';
import { InMemoryEventSink } from '../adapters/eventSink';
import { buildRequestContext } from '../pipeline/bootstrapContext';
import {
  DEFAULT_CONFIDENCE_PROFILE,
  type ConfidenceDecisionInput,
  type ConfidenceGate,
  type ConfidenceWeightProfile
} from '../pipeline/confidence/confidenceContracts';
import { computeConfidenceDecision } from '../pipeline/confidence/confidenceEngine';
import {
  buildConfidenceExplainability,
  type ConfidenceExplainability
} from '../pipeline/confidence/explainability';
import type { PlanMode } from '../pipeline/contracts';
import type { PipelineOrchestrator } from '../pipeline/orchestrator';
import type { PipelineState } from '../pipeline/stateMachine';
import { parseSlashPlanInput } from './slashPlanParser';
import { QUICK_ACTIONS, type QuickAction } from './actions';

const CONFIDENCE_GATE_ACTIONS: Record<ConfidenceGate, readonly QuickAction[]> = {
  reject: ['cancel'],
  approval_required: ['continue', 'cancel'],
  continue: ['continue']
};

type FreeTextPurpose = 'additional_context_or_instruction';

interface RequestSnapshot {
  requestId: string;
  mode: PlanMode;
  ticketId?: string;
  warnings: string[];
  userContextParts: string[];
}

const REQUEST_SNAPSHOTS = new Map<string, RequestSnapshot>();

export interface ConfidenceInputFactoryArgs {
  requestId: string;
  mode: PlanMode;
  ticketId?: string;
  userContext?: string;
  warnings: string[];
  freeTextContext: string[];
}

export interface PlanCommandResponse {
  requestId: string;
  mode: PlanMode;
  state?: PipelineState;
  ticketId?: string;
  message: string;
  userContext?: string;
  warnings: string[];
  availableActions: readonly QuickAction[];
  confidenceScore: number;
  decisionGate: ConfidenceGate;
  confidenceProfileId: string;
  acceptsFreeText: boolean;
  freeTextPurpose: FreeTextPurpose;
  explainability: ConfidenceExplainability;
}

export interface ParticipantHandlerDeps {
  eventSink?: EventSink;
  requestIdFactory?: () => string;
  now?: () => Date;
  orchestrator?: PipelineOrchestrator;
  confidenceProfile?: ConfidenceWeightProfile;
  confidenceInputFactory?: (args: ConfidenceInputFactoryArgs) => ConfidenceDecisionInput;
}

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

function defaultConfidenceInputFactory(args: ConfidenceInputFactoryArgs): ConfidenceDecisionInput {
  const userContextScore = args.userContext
    ? Math.min(85, 60 + (args.userContext.length / 12))
    : 45;

  return {
    componentScores: {
      repo: 62,
      jira: args.mode === 'ticket' ? 72 : 56,
      confluence: args.ticketId ? 54 : 48,
      user_context: userContextScore
    },
    evidence: [
      args.ticketId
        ? {
            source: 'jira',
            issueKey: args.ticketId,
            snippet: `ticket=${args.ticketId}`
          }
        : {
            source: 'user_context',
            snippet: args.userContext ?? ''
          }
    ],
    reasons: args.warnings
  };
}

function joinUserContext(parts: string[]): string | undefined {
  const merged = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n');

  return merged ? merged : undefined;
}

function toMessage(mode: PlanMode, gate: ConfidenceGate): string {
  if (gate === 'reject') {
    return 'Confidence is below 40. Run is blocked until additional context is provided.';
  }

  if (gate === 'approval_required') {
    if (mode === 'ticket') {
      return 'Confidence is between 40 and 70. Review context and choose Continue or Cancel.';
    }
    return 'No-ticket flow confidence is between 40 and 70. Add context or choose Continue/Cancel.';
  }

  return 'Confidence is above 70. Continuing without manual confidence gate.';
}

function syncConfidenceGateState(orchestrator: PipelineOrchestrator, requestId: string, gate: ConfidenceGate): void {
  const session = orchestrator.getSession(requestId);
  if (!session) {
    return;
  }

  if (gate === 'reject') {
    orchestrator.transition(requestId, 'cancelled', 'confidence_reject');
    return;
  }

  if (session.state === 'initialized') {
    orchestrator.transition(requestId, 'awaiting_plan_approval', 'confidence_gate_entered');
  }

  if (gate === 'continue') {
    const current = orchestrator.getSession(requestId);
    if (current?.state === 'awaiting_plan_approval') {
      orchestrator.transition(requestId, 'plan_approved', 'confidence_auto_continue');
    }
  }
}

function buildConfidenceContext(
  deps: ParticipantHandlerDeps,
  args: ConfidenceInputFactoryArgs
): { decision: ReturnType<typeof computeConfidenceDecision>; explainability: ConfidenceExplainability } {
  const confidenceInputFactory = deps.confidenceInputFactory ?? defaultConfidenceInputFactory;
  const profile = deps.confidenceProfile ?? DEFAULT_CONFIDENCE_PROFILE;
  const confidenceInput = confidenceInputFactory(args);
  const decision = computeConfidenceDecision(confidenceInput, profile);
  const explainability = buildConfidenceExplainability(decision, confidenceInput);

  return {
    decision,
    explainability
  };
}

function buildResponse(
  requestId: string,
  mode: PlanMode,
  ticketId: string | undefined,
  userContext: string | undefined,
  warnings: string[],
  state: PipelineState | undefined,
  decision: ReturnType<typeof computeConfidenceDecision>,
  explainability: ConfidenceExplainability
): PlanCommandResponse {
  return {
    requestId,
    mode,
    state,
    ticketId,
    message: toMessage(mode, decision.gate),
    userContext,
    warnings,
    availableActions: CONFIDENCE_GATE_ACTIONS[decision.gate],
    confidenceScore: decision.finalScore,
    decisionGate: decision.gate,
    confidenceProfileId: decision.profileId,
    acceptsFreeText: decision.gate === 'approval_required',
    freeTextPurpose: 'additional_context_or_instruction',
    explainability
  };
}

export function handlePlanCommand(rawInput: string, deps: ParticipantHandlerDeps = {}): PlanCommandResponse {
  const eventSink = deps.eventSink ?? new InMemoryEventSink();
  const now = deps.now ?? (() => new Date());

  const parseResult = parseSlashPlanInput(rawInput);
  const requestContext = buildRequestContext(parseResult, {
    requestIdFactory: deps.requestIdFactory,
    now
  });

  emitEvent(eventSink, requestContext.requestId, 'participant', 'command_received', now, {
    normalizedInput: parseResult.normalizedInput,
    mode: parseResult.mode
  });

  emitEvent(eventSink, requestContext.requestId, 'parser', 'parse_completed', now, {
    warnings: requestContext.warnings
  });

  emitEvent(eventSink, requestContext.requestId, 'bootstrap', 'context_bootstrapped', now, {
    hasUserContext: Boolean(requestContext.userContext),
    source: requestContext.userContext?.source
  });

  const userContextParts = requestContext.userContext?.text ? [requestContext.userContext.text] : [];

  const { decision, explainability } = buildConfidenceContext(deps, {
    requestId: requestContext.requestId,
    mode: requestContext.mode,
    ticketId: requestContext.ticketId,
    userContext: requestContext.userContext?.text,
    warnings: requestContext.warnings,
    freeTextContext: []
  });

  emitEvent(
    eventSink,
    requestContext.requestId,
    'gate',
    'confidence_computed',
    now,
    {
      finalScore: decision.finalScore,
      thresholds: decision.thresholds
    },
    decision.profileId,
    decision.gate
  );

  REQUEST_SNAPSHOTS.set(requestContext.requestId, {
    requestId: requestContext.requestId,
    mode: requestContext.mode,
    ticketId: requestContext.ticketId,
    warnings: [...requestContext.warnings],
    userContextParts
  });

  if (deps.orchestrator) {
    deps.orchestrator.startSession(requestContext.requestId, 'initialized');
    deps.orchestrator.setConfidenceDecision(requestContext.requestId, decision.profileId, decision.gate);
    syncConfidenceGateState(deps.orchestrator, requestContext.requestId, decision.gate);
  }

  const activeSession = deps.orchestrator?.getSession(requestContext.requestId);

  return buildResponse(
    requestContext.requestId,
    requestContext.mode,
    requestContext.ticketId,
    requestContext.userContext?.text,
    requestContext.warnings,
    activeSession?.state,
    decision,
    explainability
  );
}

export function handleGateFreeText(
  requestId: string,
  freeText: string,
  deps: ParticipantHandlerDeps = {}
): PlanCommandResponse {
  const snapshot = REQUEST_SNAPSHOTS.get(requestId);
  if (!snapshot) {
    throw new Error(`Unknown requestId: ${requestId}`);
  }

  const eventSink = deps.eventSink ?? new InMemoryEventSink();
  const now = deps.now ?? (() => new Date());

  const trimmed = freeText.trim();
  if (!trimmed) {
    const existingSession = deps.orchestrator?.getSession(requestId);
    const { decision, explainability } = buildConfidenceContext(deps, {
      requestId,
      mode: snapshot.mode,
      ticketId: snapshot.ticketId,
      userContext: joinUserContext(snapshot.userContextParts),
      warnings: snapshot.warnings,
      freeTextContext: snapshot.userContextParts
    });

    return buildResponse(
      requestId,
      snapshot.mode,
      snapshot.ticketId,
      joinUserContext(snapshot.userContextParts),
      snapshot.warnings,
      existingSession?.state,
      decision,
      explainability
    );
  }

  snapshot.userContextParts.push(trimmed);

  emitEvent(eventSink, requestId, 'gate', 'free_text_received', now, {
    freeTextLength: trimmed.length
  });

  deps.orchestrator?.appendFreeTextContext(requestId, trimmed);

  const mergedUserContext = joinUserContext(snapshot.userContextParts);
  const { decision, explainability } = buildConfidenceContext(deps, {
    requestId,
    mode: snapshot.mode,
    ticketId: snapshot.ticketId,
    userContext: mergedUserContext,
    warnings: snapshot.warnings,
    freeTextContext: [...snapshot.userContextParts]
  });

  emitEvent(
    eventSink,
    requestId,
    'gate',
    'confidence_recomputed_from_free_text',
    now,
    {
      finalScore: decision.finalScore,
      freeTextCount: snapshot.userContextParts.length
    },
    decision.profileId,
    decision.gate
  );

  if (deps.orchestrator) {
    deps.orchestrator.setConfidenceDecision(requestId, decision.profileId, decision.gate);
    syncConfidenceGateState(deps.orchestrator, requestId, decision.gate);
  }

  const activeSession = deps.orchestrator?.getSession(requestId);

  return buildResponse(
    requestId,
    snapshot.mode,
    snapshot.ticketId,
    mergedUserContext,
    snapshot.warnings,
    activeSession?.state,
    decision,
    explainability
  );
}

export function createParticipantRequestHandler(deps: ParticipantHandlerDeps = {}) {
  return async (...args: unknown[]): Promise<PlanCommandResponse> => {
    const firstArg = args[0];
    const rawInput = typeof firstArg === 'string' ? firstArg : '/plan';
    return handlePlanCommand(rawInput, deps);
  };
}

export function getRequestSnapshot(requestId: string): Readonly<RequestSnapshot> | undefined {
  return REQUEST_SNAPSHOTS.get(requestId);
}
