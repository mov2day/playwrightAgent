export type ScenarioRiskLevel = 'low' | 'medium' | 'high';

export type ScenarioApprovalState = 'pending' | 'approved' | 'rejected' | 'needs_revision';

export interface ScenarioCommentRef {
  commentId: string;
  target: 'scenario' | 'global';
}

export interface ScenarioPlanRecord {
  scenarioId: string;
  scenarioName: string;
  scope: string;
  assertionIntentSummary: string;
  primaryRequirementId: string;
  acceptanceCriteriaIds: string[];
  riskLevel: 'low' | 'medium' | 'high';
  riskReason: string;
  mitigation?: string;
  sourceEvidenceIds: string[];
  functionality: string;
  approvalState: ScenarioApprovalState;
  revisionReason: string[];
  commentRefs: ScenarioCommentRef[];
}

export interface ScenarioGroupingIndexes {
  byRequirementId: Record<string, string[]>;
  byAcceptanceCriteriaId: Record<string, string[]>;
  byFunctionality: Record<string, string[]>;
  rejectedScenarioIds: string[];
}

export interface PlanReviewBundle {
  flatScenarios: ScenarioPlanRecord[];
  groupIndexes: ScenarioGroupingIndexes;
}
