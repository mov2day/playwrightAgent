import { describe, expect, it } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import { PipelineOrchestrator, type StageEntryGateEvaluator } from '../../src/pipeline/orchestrator';
import { handlePlanCommand } from '../../src/participant/handler';

function createGateEvaluator(overrides: Partial<Record<'planning' | 'generation' | 'preview' | 'write', boolean>>): StageEntryGateEvaluator {
  return (stage) => {
    const blocked = overrides[stage] ?? false;
    return {
      stage,
      blocked,
      fail_closed: blocked,
      requires_user_decision: blocked,
      reasons: blocked
        ? [{
            code: 'manifest_unavailable',
            check: 'manifest',
            message: `${stage} blocked for test`
          }]
        : [],
      manifest_hash: blocked ? undefined : 'stable-manifest-hash'
    };
  };
}

describe('skills stage-entry gate', () => {
  it('blocks planning stage entry before transition side effects execute', () => {
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-06-01T00:00:00.000Z');
    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now,
      stageEntryGateEvaluator: createGateEvaluator({ planning: true })
    });

    orchestrator.startSession('req_stage_gate_1', 'initialized');
    const result = orchestrator.transition('req_stage_gate_1', 'awaiting_plan_approval', 'confidence_gate_entered');

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('STAGE_ENTRY_BLOCKED');
    expect(result.stageEntry?.stage).toBe('planning');
    expect(result.stageEntry?.availableActions).toEqual(['approve', 'reject', 'continue', 'cancel']);
    expect(orchestrator.getSession('req_stage_gate_1')?.state).toBe('initialized');
  });

  it('blocks generation, preview, and write stage entries with fail-closed guard results', () => {
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-06-01T00:00:00.000Z');
    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now,
      stageEntryGateEvaluator: createGateEvaluator({
        generation: true,
        preview: true,
        write: true
      })
    });

    orchestrator.startSession('req_stage_gate_2', 'initialized');
    const planningTransition = orchestrator.transition('req_stage_gate_2', 'awaiting_plan_approval', 'confidence_gate_entered');
    expect(planningTransition.ok).toBe(true);
    expect(orchestrator.handleQuickAction('req_stage_gate_2', 'approve').ok).toBe(true);
    expect(orchestrator.getSession('req_stage_gate_2')?.state).toBe('plan_approved');

    const generationEntry = orchestrator.handleQuickAction('req_stage_gate_2', 'continue');
    expect(generationEntry.ok).toBe(false);
    expect(generationEntry.errorCode).toBe('STAGE_ENTRY_BLOCKED');
    expect(generationEntry.stageEntry?.stage).toBe('generation');

    orchestrator.transition('req_stage_gate_2', 'awaiting_script_approval', 'manual_override_for_test');
    orchestrator.handleQuickAction('req_stage_gate_2', 'approve');

    const previewEntry = orchestrator.handleQuickAction('req_stage_gate_2', 'continue');
    expect(previewEntry.ok).toBe(false);
    expect(previewEntry.stageEntry?.stage).toBe('preview');

    orchestrator.transition('req_stage_gate_2', 'ready_to_write', 'manual_override_for_test');
    const writeEntry = orchestrator.transition('req_stage_gate_2', 'completed', 'write_stage_entry');

    expect(writeEntry.ok).toBe(false);
    expect(writeEntry.errorCode).toBe('STAGE_ENTRY_BLOCKED');
    expect(writeEntry.stageEntry?.stage).toBe('write');
  });

  it('prevents handler planning stage progression when stage-entry gate blocks', () => {
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-06-01T00:00:00.000Z');
    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now,
      stageEntryGateEvaluator: createGateEvaluator({ planning: true })
    });

    const response = handlePlanCommand('/plan QA-700 checkout flow', {
      eventSink: sink,
      now,
      orchestrator,
      requestIdFactory: () => 'req_stage_gate_3'
    });

    expect(response.state).toBe('initialized');
    const blockedEvents = sink.getEvents().filter((event) => event.action === 'stage_entry_blocked');
    expect(blockedEvents.length).toBeGreaterThan(0);
  });
});
