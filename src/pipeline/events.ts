import type { PipelineState } from './stateMachine';

export type PipelineStage = 'participant' | 'parser' | 'bootstrap' | 'orchestrator' | 'gate' | 'ui';

export interface PipelineStageEvent {
  requestId: string;
  stage: PipelineStage;
  action: string;
  state?: PipelineState;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface CreatePipelineEventInput {
  requestId: string;
  stage: PipelineStage;
  action: string;
  state?: PipelineState;
  details?: Record<string, unknown>;
}

export function createPipelineEvent(
  input: CreatePipelineEventInput,
  now: () => Date = () => new Date()
): PipelineStageEvent {
  return {
    requestId: input.requestId,
    stage: input.stage,
    action: input.action,
    state: input.state,
    timestamp: now().toISOString(),
    details: input.details
  };
}
