import { describe, expect, it } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import type { ConfidenceDecisionInput } from '../../src/pipeline/confidence/confidenceContracts';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';
import { handleGateFreeText, handlePlanCommand } from '../../src/participant/handler';

function uniformConfidence(score: number): ConfidenceDecisionInput {
  return {
    componentScores: {
      repo: score,
      jira: score,
      confluence: score,
      user_context: score
    },
    evidence: [],
    reasons: []
  };
}

describe('confidence gate flow', () => {
  it('reject under 40', () => {
    const sink = new InMemoryEventSink();
    const orchestrator = new PipelineOrchestrator({ eventSink: sink });

    const response = handlePlanCommand('/plan QA-300', {
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_conf_gate_1',
      confidenceInputFactory: () => uniformConfidence(39.99),
      now: () => new Date('2026-05-30T16:00:00.000Z')
    });

    expect(response.decisionGate).toBe('reject');
    expect(response.state).toBe('cancelled');
    expect(response.availableActions).toEqual(['cancel']);
  });

  it('gate between 40 and 70', () => {
    const sink = new InMemoryEventSink();
    const orchestrator = new PipelineOrchestrator({ eventSink: sink });

    const response = handlePlanCommand('/plan QA-301', {
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_conf_gate_2',
      confidenceInputFactory: () => uniformConfidence(55),
      now: () => new Date('2026-05-30T16:00:00.000Z')
    });

    expect(response.decisionGate).toBe('approval_required');
    expect(response.state).toBe('awaiting_plan_approval');
    expect(response.availableActions).toEqual(['approve', 'reject', 'cancel']);
    expect(response.acceptsFreeText).toBe(true);

    const recomputed = handleGateFreeText(response.requestId, 'Add explicit acceptance criteria and selectors', {
      eventSink: sink,
      orchestrator,
      now: () => new Date('2026-05-30T16:01:00.000Z'),
      confidenceInputFactory: ({ freeTextContext }) => {
        return freeTextContext.length >= 1 ? uniformConfidence(75) : uniformConfidence(55);
      }
    });

    expect(recomputed.userContext).toContain('Add explicit acceptance criteria and selectors');
    expect(recomputed.decisionGate).toBe('continue');
    expect(recomputed.state).toBe('awaiting_plan_approval');

    const actions = sink.getEvents().map((event) => event.action);
    expect(actions).toContain('free_text_received');
    expect(actions).toContain('confidence_recomputed_from_free_text');
  });

  it('still requires explicit plan approval above 70', () => {
    const sink = new InMemoryEventSink();
    const orchestrator = new PipelineOrchestrator({ eventSink: sink });

    const response = handlePlanCommand('/plan QA-302', {
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_conf_gate_3',
      confidenceInputFactory: () => uniformConfidence(70.01),
      now: () => new Date('2026-05-30T16:00:00.000Z')
    });

    expect(response.decisionGate).toBe('continue');
    expect(response.state).toBe('awaiting_plan_approval');
    expect(response.availableActions).toEqual(['approve', 'reject', 'cancel']);
  });
});
