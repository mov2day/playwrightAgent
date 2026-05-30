export type PipelineState =
  | 'initialized'
  | 'awaiting_plan_approval'
  | 'plan_approved'
  | 'plan_rejected'
  | 'awaiting_script_approval'
  | 'script_approved'
  | 'script_rejected'
  | 'ready_to_write'
  | 'completed'
  | 'cancelled';

export interface TransitionResult {
  ok: boolean;
  from: PipelineState;
  to: PipelineState;
  errorCode?: 'ILLEGAL_TRANSITION';
}

export const ALLOWED_TRANSITIONS: Readonly<Record<PipelineState, readonly PipelineState[]>> = {
  initialized: ['awaiting_plan_approval', 'cancelled'],
  awaiting_plan_approval: ['plan_approved', 'plan_rejected', 'cancelled'],
  plan_approved: ['awaiting_script_approval', 'cancelled'],
  plan_rejected: ['cancelled'],
  awaiting_script_approval: ['script_approved', 'script_rejected', 'cancelled'],
  script_approved: ['ready_to_write', 'cancelled'],
  script_rejected: ['awaiting_script_approval', 'cancelled'],
  ready_to_write: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

export function canTransition(from: PipelineState, to: PipelineState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionState(from: PipelineState, to: PipelineState): TransitionResult {
  if (!canTransition(from, to)) {
    return {
      ok: false,
      from,
      to,
      errorCode: 'ILLEGAL_TRANSITION'
    };
  }

  return {
    ok: true,
    from,
    to
  };
}
