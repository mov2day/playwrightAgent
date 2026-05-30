import type { EventSink } from '../adapters/eventSink';
import type { QuickAction } from '../participant/actions';
import { createPipelineEvent } from './events';
import type { PipelineState, TransitionResult } from './stateMachine';
import { transitionState } from './stateMachine';

interface PipelineSession {
  requestId: string;
  state: PipelineState;
  createdAt: string;
  updatedAt: string;
}

export interface OrchestratorDeps {
  eventSink: EventSink;
  now?: () => Date;
}

export interface ActionTransitionResult {
  ok: boolean;
  requestId: string;
  from: PipelineState;
  to?: PipelineState;
  errorCode?: 'UNKNOWN_REQUEST' | 'UNMAPPED_ACTION' | 'ILLEGAL_TRANSITION';
}

export class PipelineOrchestrator {
  private readonly sessions = new Map<string, PipelineSession>();

  private readonly eventSink: EventSink;

  private readonly now: () => Date;

  constructor(deps: OrchestratorDeps) {
    this.eventSink = deps.eventSink;
    this.now = deps.now ?? (() => new Date());
  }

  startSession(requestId: string, initialState: PipelineState = 'initialized'): PipelineSession {
    const timestamp = this.now().toISOString();
    const session: PipelineSession = {
      requestId,
      state: initialState,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.sessions.set(requestId, session);
    this.emit(requestId, 'orchestrator', 'session_started', initialState);
    return session;
  }

  getSession(requestId: string): PipelineSession | undefined {
    return this.sessions.get(requestId);
  }

  transition(requestId: string, to: PipelineState, action: string): ActionTransitionResult {
    const session = this.sessions.get(requestId);
    if (!session) {
      return {
        ok: false,
        requestId,
        from: 'initialized',
        errorCode: 'UNKNOWN_REQUEST'
      };
    }

    const transition = transitionState(session.state, to);
    if (!transition.ok) {
      this.emit(requestId, 'gate', 'transition_blocked', session.state, {
        attempted: to,
        action,
        errorCode: transition.errorCode
      });

      return {
        ok: false,
        requestId,
        from: session.state,
        errorCode: transition.errorCode
      };
    }

    session.state = to;
    session.updatedAt = this.now().toISOString();

    this.emit(requestId, 'gate', 'transition_applied', session.state, {
      from: transition.from,
      to: transition.to,
      action
    });

    return {
      ok: true,
      requestId,
      from: transition.from,
      to: transition.to
    };
  }

  handleQuickAction(requestId: string, action: QuickAction): ActionTransitionResult {
    const session = this.sessions.get(requestId);
    if (!session) {
      return {
        ok: false,
        requestId,
        from: 'initialized',
        errorCode: 'UNKNOWN_REQUEST'
      };
    }

    let targetState: PipelineState | undefined;

    if (action === 'cancel') {
      targetState = 'cancelled';
    } else if (action === 'approve') {
      if (session.state === 'awaiting_plan_approval') {
        targetState = 'plan_approved';
      } else if (session.state === 'awaiting_script_approval') {
        targetState = 'script_approved';
      }
    } else if (action === 'reject') {
      if (session.state === 'awaiting_plan_approval') {
        targetState = 'plan_rejected';
      } else if (session.state === 'awaiting_script_approval') {
        targetState = 'script_rejected';
      }
    } else if (action === 'continue') {
      if (session.state === 'plan_approved') {
        targetState = 'awaiting_script_approval';
      } else if (session.state === 'script_approved') {
        targetState = 'ready_to_write';
      }
    }

    if (!targetState) {
      this.emit(requestId, 'gate', 'quick_action_unmapped', session.state, {
        action
      });
      return {
        ok: false,
        requestId,
        from: session.state,
        errorCode: 'UNMAPPED_ACTION'
      };
    }

    return this.transition(requestId, targetState, action);
  }

  private emit(
    requestId: string,
    stage: 'orchestrator' | 'gate',
    action: string,
    state?: PipelineState,
    details?: Record<string, unknown>
  ): void {
    const event = createPipelineEvent(
      {
        requestId,
        stage,
        action,
        state,
        details
      },
      this.now
    );

    this.eventSink.emit(event);
  }
}

export function applyTransitionResult(
  result: TransitionResult,
  requestId: string
): ActionTransitionResult {
  if (!result.ok) {
    return {
      ok: false,
      requestId,
      from: result.from,
      errorCode: result.errorCode
    };
  }

  return {
    ok: true,
    requestId,
    from: result.from,
    to: result.to
  };
}
