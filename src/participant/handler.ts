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
import type { PlanReviewBundle, ScenarioPlanRecord } from '../pipeline/planning/planContracts';
import { buildPlanReviewBundle } from '../pipeline/planning/scenarioGrouping';
import { buildScenarioPlan, type RequirementScenarioInput } from '../pipeline/planning/scenarioMapper';
import { formatPlanChatSummary } from '../pipeline/planning/planSummary';
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
type FreeTextCommentTarget = 'scenario' | 'global';
type FreeTextCommentClassification = 'clarification' | 'constraint' | 'bug' | 'new_context';

interface ClassifiedFreeTextComment {
  target: 'scenario' | 'global';
  classification: 'clarification' | 'constraint' | 'bug' | 'new_context';
  scenarioId?: string;
  text: string;
}

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

export interface PlanBundleFactoryArgs {
  requestId: string;
  mode: PlanMode;
  ticketId?: string;
  userContext?: string;
  warnings: string[];
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
  planSummary?: string;
  planScenarios?: readonly ScenarioPlanRecord[];
}

export interface ParticipantHandlerDeps {
  eventSink?: EventSink;
  requestIdFactory?: () => string;
  now?: () => Date;
  orchestrator?: PipelineOrchestrator;
  confidenceProfile?: ConfidenceWeightProfile;
  confidenceInputFactory?: (args: ConfidenceInputFactoryArgs) => ConfidenceDecisionInput;
  planBundleFactory?: (args: PlanBundleFactoryArgs) => PlanReviewBundle | undefined;
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

function pickFunctionality(sentence: string): string {
  const tokens = sentence
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);

  return tokens[0]
    ? `${tokens[0][0]?.toUpperCase() ?? ''}${tokens[0].slice(1)}`
    : 'General';
}

function splitScenarioSentences(userContext: string | undefined): string[] {
  if (!userContext?.trim()) {
    return [];
  }

  return userContext
    .split(/[\n.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function toScenarioInputs(args: PlanBundleFactoryArgs): RequirementScenarioInput[] {
  const seedSentences = splitScenarioSentences(args.userContext);
  const baseScope = args.mode === 'ticket' ? 'Ticket-driven functional validation' : 'No-ticket exploratory validation';
  const requirementPrefix = args.ticketId?.toUpperCase() ?? 'PLAN-MANUAL';

  if (seedSentences.length === 0) {
    return [
      {
        requirementId: requirementPrefix,
        acceptanceCriteriaIds: ['AC-1'],
        scenarioName: args.mode === 'ticket'
          ? `Validate ${requirementPrefix} acceptance flow`
          : 'Validate supplied manual scope',
        scope: baseScope,
        assertionIntentSummary: args.mode === 'ticket'
          ? 'Confirm acceptance criteria and essential guardrails for the provided ticket.'
          : 'Confirm manual requirements and acceptance criteria supplied in chat context.',
        functionality: 'General',
        riskLevel: 'medium',
        riskReason: 'Planning details are inferred and should be reviewed before generation.',
        sourceEvidenceIds: args.ticketId ? [args.ticketId] : ['chat_context']
      }
    ];
  }

  return seedSentences.map((sentence, index) => {
    const requirementId = `${requirementPrefix}-${index + 1}`;

    return {
      requirementId,
      acceptanceCriteriaIds: [`AC-${index + 1}`],
      scenarioName: `Scenario ${index + 1}: ${sentence.slice(0, 64)}`,
      scope: baseScope,
      assertionIntentSummary: sentence,
      functionality: pickFunctionality(sentence),
      riskLevel: index === 0 ? 'medium' : 'low',
      riskReason: index === 0
        ? 'Primary scenario anchors confidence and should be explicitly reviewed.'
        : 'Derived scenario from user context; lower risk but still reviewable.',
      sourceEvidenceIds: [`ctx_${index + 1}`]
    };
  });
}

function defaultPlanBundleFactory(args: PlanBundleFactoryArgs): PlanReviewBundle | undefined {
  const inputs = toScenarioInputs(args);
  const records = buildScenarioPlan(inputs);
  if (records.length === 0) {
    return undefined;
  }

  return buildPlanReviewBundle(records);
}

function classifyFreeTextComment(text: string): ClassifiedFreeTextComment {
  const normalized = text.trim();
  const scenarioIdMatch = normalized.match(/\b(scn_[a-z0-9_]+)\b/i);
  const scenarioId = scenarioIdMatch?.[1]?.toLowerCase();
  let classification: FreeTextCommentClassification = 'clarification';

  if (/(?:\bmust\b|\bconstraint\b|\blimit\b|\bcannot\b|\bshould not\b)/i.test(normalized)) {
    classification = 'constraint';
  } else if (/(?:\bbug\b|\bfail(?:ing|ed)?\b|\berror\b|\bbroken\b|\bflaky\b)/i.test(normalized)) {
    classification = 'bug';
  } else if (/(?:\bnew\b|\badd\b|\balso\b|\binclude\b|\banother\b)/i.test(normalized)) {
    classification = 'new_context';
  }

  const target: FreeTextCommentTarget = scenarioId ? 'scenario' : 'global';

  return {
    target,
    classification,
    scenarioId,
    text: normalized
  };
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
  explainability: ConfidenceExplainability,
  planBundle: PlanReviewBundle | undefined
): PlanCommandResponse {
  const planSummary = planBundle ? formatPlanChatSummary(planBundle) : undefined;

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
    explainability,
    planSummary,
    planScenarios: planBundle?.flatScenarios
  };
}

export function handlePlanCommand(rawInput: string, deps: ParticipantHandlerDeps = {}): PlanCommandResponse {
  const eventSink = deps.eventSink ?? new InMemoryEventSink();
  const now = deps.now ?? (() => new Date());
  const planBundleFactory = deps.planBundleFactory ?? defaultPlanBundleFactory;

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
  const initialUserContext = joinUserContext(userContextParts);

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
  const planBundle = decision.gate === 'reject'
    ? undefined
    : planBundleFactory({
        requestId: requestContext.requestId,
        mode: requestContext.mode,
        ticketId: requestContext.ticketId,
        userContext: initialUserContext,
        warnings: requestContext.warnings
      });

  if (deps.orchestrator && planBundle) {
    deps.orchestrator.seedReviewRecords(requestContext.requestId, planBundle.flatScenarios);
  }

  return buildResponse(
    requestContext.requestId,
    requestContext.mode,
    requestContext.ticketId,
    initialUserContext,
    requestContext.warnings,
    activeSession?.state,
    decision,
    explainability,
    planBundle
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
  const planBundleFactory = deps.planBundleFactory ?? defaultPlanBundleFactory;

  const trimmed = freeText.trim();
  if (!trimmed) {
    const existingSession = deps.orchestrator?.getSession(requestId);
    const currentUserContext = joinUserContext(snapshot.userContextParts);
    const { decision, explainability } = buildConfidenceContext(deps, {
      requestId,
      mode: snapshot.mode,
      ticketId: snapshot.ticketId,
      userContext: currentUserContext,
      warnings: snapshot.warnings,
      freeTextContext: snapshot.userContextParts
    });
    const planBundle = decision.gate === 'reject'
      ? undefined
      : planBundleFactory({
          requestId,
          mode: snapshot.mode,
          ticketId: snapshot.ticketId,
          userContext: currentUserContext,
          warnings: snapshot.warnings
        });

    return buildResponse(
      requestId,
      snapshot.mode,
      snapshot.ticketId,
      currentUserContext,
      snapshot.warnings,
      existingSession?.state,
      decision,
      explainability,
      planBundle
    );
  }

  snapshot.userContextParts.push(trimmed);

  emitEvent(eventSink, requestId, 'gate', 'free_text_received', now, {
    freeTextLength: trimmed.length
  });

  deps.orchestrator?.appendFreeTextContext(requestId, trimmed);
  const classifiedComment = classifyFreeTextComment(trimmed);
  if (deps.orchestrator) {
    deps.orchestrator.applyScenarioAction(requestId, {
      type: 'comment.add',
      requestId,
      source: 'chat',
      optimisticVersion: now().getTime(),
      target: classifiedComment.target,
      classification: classifiedComment.classification,
      scenarioId: classifiedComment.scenarioId,
      text: classifiedComment.text
    });
  }

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
  const planBundle = decision.gate === 'reject'
    ? undefined
    : planBundleFactory({
        requestId,
        mode: snapshot.mode,
        ticketId: snapshot.ticketId,
        userContext: mergedUserContext,
        warnings: snapshot.warnings
      });

  return buildResponse(
    requestId,
    snapshot.mode,
    snapshot.ticketId,
    mergedUserContext,
    snapshot.warnings,
    activeSession?.state,
    decision,
    explainability,
    planBundle
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
