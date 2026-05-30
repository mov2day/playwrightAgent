import type { EventSink, PipelineEvent } from '../adapters/eventSink';
import { InMemoryEventSink } from '../adapters/eventSink';
import { QUICK_ACTIONS, type QuickAction } from './actions';

export interface PlanCommandResponse {
  requestId: string;
  mode: 'no_ticket' | 'raw_input';
  message: string;
  availableActions: readonly QuickAction[];
}

export interface ParticipantHandlerDeps {
  eventSink?: EventSink;
  requestIdFactory?: () => string;
  now?: () => Date;
}

function defaultRequestIdFactory(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `req_${Date.now()}_${random}`;
}

function emitEvent(
  sink: EventSink,
  requestId: string,
  action: string,
  now: () => Date,
  details?: Record<string, unknown>
): void {
  const event: PipelineEvent = {
    requestId,
    stage: 'participant',
    action,
    timestamp: now().toISOString(),
    details
  };
  sink.emit(event);
}

export function handlePlanCommand(rawInput: string, deps: ParticipantHandlerDeps = {}): PlanCommandResponse {
  const eventSink = deps.eventSink ?? new InMemoryEventSink();
  const requestIdFactory = deps.requestIdFactory ?? defaultRequestIdFactory;
  const now = deps.now ?? (() => new Date());
  const requestId = requestIdFactory();
  const trimmed = rawInput.trim();

  emitEvent(eventSink, requestId, 'command_received', now, {
    inputLength: trimmed.length
  });

  if (trimmed.length === 0 || trimmed === '/plan') {
    emitEvent(eventSink, requestId, 'no_ticket_guidance_prompted', now);
    return {
      requestId,
      mode: 'no_ticket',
      message: 'No ticket provided. Share requirement context to continue in no-ticket mode.',
      availableActions: QUICK_ACTIONS
    };
  }

  emitEvent(eventSink, requestId, 'raw_input_received', now, {
    input: trimmed
  });

  return {
    requestId,
    mode: 'raw_input',
    message: 'Input received. Parser bootstrap will classify ticket/no-ticket in the next stage.',
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
