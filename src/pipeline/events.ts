import type { PipelineState } from './stateMachine';

export type PipelineStage = 'participant' | 'parser' | 'bootstrap' | 'orchestrator' | 'gate' | 'ui';
export type PipelineInteractionType = 'ai_interaction' | 'gate_decision' | 'system_event';
export type PipelineDecisionAction = 'approve' | 'reject' | 'continue' | 'cancel';

export const PIPELINE_EVENT_SCHEMA_VERSION = 'pipeline_event.v1';

export interface PipelineStageEvent {
  requestId: string;
  stage: PipelineStage;
  action: string;
  state?: PipelineState;
  confidenceProfileId?: string;
  decisionGate?: 'reject' | 'approval_required' | 'continue';
  timestamp: string;
  schemaVersion: string;
  interactionType?: PipelineInteractionType;
  decisionAction?: PipelineDecisionAction;
  decisionComment?: string;
  details?: Record<string, unknown>;
}

export interface CreatePipelineEventInput {
  requestId: string;
  stage: PipelineStage;
  action: string;
  state?: PipelineState;
  confidenceProfileId?: string;
  decisionGate?: 'reject' | 'approval_required' | 'continue';
  schemaVersion?: string;
  interactionType?: PipelineInteractionType;
  decisionAction?: PipelineDecisionAction;
  decisionComment?: string;
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
    confidenceProfileId: input.confidenceProfileId,
    decisionGate: input.decisionGate,
    timestamp: now().toISOString(),
    schemaVersion: input.schemaVersion ?? PIPELINE_EVENT_SCHEMA_VERSION,
    interactionType: input.interactionType,
    decisionAction: input.decisionAction,
    decisionComment: input.decisionComment,
    details: input.details
  };
}
