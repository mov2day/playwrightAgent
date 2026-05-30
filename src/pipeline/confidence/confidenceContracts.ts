export type ConfidenceGate = 'reject' | 'approval_required' | 'continue';

export interface ConfidenceComponentScores {
  repo: number;
  jira: number;
  confluence: number;
  user_context: number;
}

export interface ConfidenceWeightProfile {
  profileId: string;
  version: string;
  weights: ConfidenceComponentScores;
}

export interface ConfidenceThresholdPolicy {
  rejectBelow: number;
  approvalMin: number;
  approvalMax: number;
  continueAbove: number;
}

export interface ConfidenceEvidenceRef {
  source: string;
  issueKey?: string;
  pageId?: string;
  findingId?: string;
  snippet?: string;
  metadata?: Record<string, string>;
}

export interface ConfidenceDecisionInput {
  componentScores: ConfidenceComponentScores;
  evidence?: ConfidenceEvidenceRef[];
  reasons?: string[];
}

export interface ConfidenceDecision {
  profileId: string;
  profileVersion: string;
  gate: ConfidenceGate;
  componentScores: ConfidenceComponentScores;
  finalScore: number;
  thresholds: ConfidenceThresholdPolicy;
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholdPolicy = {
  rejectBelow: 40,
  approvalMin: 40,
  approvalMax: 70,
  continueAbove: 70
};

export const DEFAULT_CONFIDENCE_PROFILE: ConfidenceWeightProfile = {
  profileId: 'v1-default',
  version: '1.0.0',
  weights: {
    repo: 0.2,
    jira: 0.45,
    confluence: 0.15,
    user_context: 0.2
  }
};
