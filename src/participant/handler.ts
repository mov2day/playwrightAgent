import type { EventSink, PipelineEvent } from '../adapters/eventSink';
import { InMemoryEventSink } from '../adapters/eventSink';
import { buildRequestContext } from '../pipeline/bootstrapContext';
import type { PlanMode } from '../pipeline/contracts';
import type { PipelineOrchestrator } from '../pipeline/orchestrator';
import type { PipelineState } from '../pipeline/stateMachine';
import { parseSlashPlanInput } from './slashPlanParser';
import { QUICK_ACTIONS, type QuickAction } from './actions';

export interface PlanCommandResponse {
  requestId: string;
  mode: PlanMode;
  state?: PipelineState;
  ticketId?: string;
  message: string;
  userContext?: string;
  warnings: string[];
  availableActions: readonly QuickAction[];
}

export interface ParticipantHandlerDeps {
  eventSink?: EventSink;
  requestIdFactory?: () => string;
  now?: () => Date;
  orchestrator?: PipelineOrchestrator;
}

function emitEvent(
  sink: EventSink,
  requestId: string,
  stage: string,
  action: string,
  now: () => Date,
  details?: Record<string, unknown>
): void {
  const event: PipelineEvent = {
    requestId,
    stage,
    action,
    timestamp: now().toISOString(),
    details
  };
  sink.emit(event);
}

function toMessage(mode: PlanMode): string {
  if (mode === 'ticket') {
    return 'Ticket mode started. Context bootstrap complete and ready for next pipeline stage.';
  }
  if (mode === 'invalid_ticket_soft_fail') {
    return 'Ticket format warning captured. Continuing safely in no-ticket mode.';
  }
  return 'No ticket provided. Share requirement context to continue in no-ticket mode.';
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

  if (deps.orchestrator) {
    deps.orchestrator.startSession(requestContext.requestId, 'initialized');
    deps.orchestrator.transition(requestContext.requestId, 'awaiting_plan_approval', 'bootstrap_complete');
  }

  const activeSession = deps.orchestrator?.getSession(requestContext.requestId);

  return {
    requestId: requestContext.requestId,
    mode: requestContext.mode,
    state: activeSession?.state,
    ticketId: requestContext.ticketId,
    message: toMessage(requestContext.mode),
    userContext: requestContext.userContext?.text,
    warnings: requestContext.warnings,
    availableActions: QUICK_ACTIONS
  };
}

export function createParticipantRequestHandler(deps: ParticipantHandlerDeps = {}) {
  return async (...args: unknown[]): Promise<PlanCommandResponse> => {
    const firstArg = args[0];
    const rawInput = typeof firstArg === 'string' ? firstArg : '/plan';
    return handlePlanCommand(rawInput, deps);
  };
}
