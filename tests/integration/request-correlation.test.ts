import { describe, expect, it } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import { handlePlanCommand } from '../../src/participant/handler';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';

describe('request correlation across orchestrator events', () => {
  it('propagates one requestId through participant, parser, bootstrap, and gate transitions', () => {
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-05-30T15:00:00.000Z');
    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now
    });

    const response = handlePlanCommand('/plan QA-77 add checkout retries', {
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_corr_1',
      now
    });

    expect(response.requestId).toBe('req_corr_1');
    expect(response.state).toBe('awaiting_plan_approval');

    const approvePlan = orchestrator.handleQuickAction(response.requestId, 'approve');
    const continueToScriptGate = orchestrator.handleQuickAction(response.requestId, 'continue');
    const approveScript = orchestrator.handleQuickAction(response.requestId, 'approve');
    const continueToWrite = orchestrator.handleQuickAction(response.requestId, 'continue');

    expect(approvePlan.ok).toBe(true);
    expect(continueToScriptGate.ok).toBe(true);
    expect(approveScript.ok).toBe(true);
    expect(continueToWrite.ok).toBe(true);

    const events = sink.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(7);
    expect(events.every((event) => event.requestId === 'req_corr_1')).toBe(true);

    const appliedTransitions = events.filter((event) => event.action === 'transition_applied');
    expect(appliedTransitions.length).toBeGreaterThanOrEqual(4);
    expect(appliedTransitions[0]?.details).toMatchObject({ to: 'awaiting_plan_approval' });
    expect(appliedTransitions.at(-1)?.details).toMatchObject({ to: 'ready_to_write' });
  });

  it('rejects unmapped quick actions without mutating state', () => {
    const sink = new InMemoryEventSink();
    const orchestrator = new PipelineOrchestrator({ eventSink: sink });

    const response = handlePlanCommand('/plan', {
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_corr_2',
      now: () => new Date('2026-05-30T15:00:00.000Z')
    });

    const result = orchestrator.handleQuickAction(response.requestId, 'continue');
    const session = orchestrator.getSession(response.requestId);

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('UNMAPPED_ACTION');
    expect(session?.state).toBe('awaiting_plan_approval');
  });
});
