import { describe, expect, it } from 'vitest';

import { canTransition, transitionState } from '../../src/pipeline/stateMachine';

describe('pipeline state machine', () => {
  it('allows legal transitions', () => {
    expect(canTransition('initialized', 'awaiting_plan_approval')).toBe(true);
    expect(canTransition('awaiting_plan_approval', 'awaiting_revision')).toBe(true);
    expect(canTransition('ready_to_write', 'awaiting_guardrail_decision')).toBe(true);
    expect(canTransition('awaiting_guardrail_decision', 'ready_to_write')).toBe(true);
    expect(transitionState('awaiting_plan_approval', 'plan_approved')).toMatchObject({
      ok: true,
      from: 'awaiting_plan_approval',
      to: 'plan_approved'
    });
  });

  it('blocks illegal transitions with explicit error code', () => {
    const result = transitionState('initialized', 'ready_to_write');

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('ILLEGAL_TRANSITION');
  });

  it('does not allow transitions from terminal states', () => {
    expect(canTransition('completed', 'awaiting_plan_approval')).toBe(false);
    expect(canTransition('cancelled', 'awaiting_plan_approval')).toBe(false);
  });
});
