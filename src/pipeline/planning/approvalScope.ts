import type { ScenarioApprovalState } from './planContracts';

export interface ApprovalScopeRecord {
  scenarioId: string;
  primaryRequirementId: string;
  acceptanceCriteriaIds: string[];
  approvalState: ScenarioApprovalState;
}

export interface RevisionCommentInput {
  target: 'scenario' | 'global';
  classification: 'clarification' | 'constraint' | 'bug' | 'new_context';
  text: string;
  scenarioId?: string;
}

export interface ApprovedScopeResult {
  approvedScenarioIds: string[];
  excludedScenarioIds: string[];
  approvedCount: number;
  excludedCount: number;
}

export interface RegenerationTargetsResult {
  regenerationScenarioIds: string[];
  impactedRequirementIds: string[];
}

export function computeApprovedScope(records: readonly ApprovalScopeRecord[]): ApprovedScopeResult {
  const approvedRecords = records.filter((record) => record.approvalState === 'approved');
  const excludedRecords = records.filter((record) => record.approvalState !== 'approved');

  return {
    approvedScenarioIds: approvedRecords.map((record) => record.scenarioId).sort((a, b) => a.localeCompare(b)),
    excludedScenarioIds: excludedRecords.map((record) => record.scenarioId).sort((a, b) => a.localeCompare(b)),
    approvedCount: approvedRecords.length,
    excludedCount: excludedRecords.length
  };
}

function extractRequirementTokens(text: string): string[] {
  const matches = text.toUpperCase().match(/[A-Z]+-\d+/g) ?? [];
  return [...new Set(matches)];
}

export function computeRegenerationTargets(
  records: readonly ApprovalScopeRecord[],
  comments: readonly RevisionCommentInput[]
): RegenerationTargetsResult {
  const scenarioIds = new Set<string>();
  const requirementIds = new Set<string>();

  for (const comment of comments) {
    if (comment.target === 'scenario' && comment.scenarioId) {
      scenarioIds.add(comment.scenarioId);
      const source = records.find((record) => record.scenarioId === comment.scenarioId);
      if (source) {
        requirementIds.add(source.primaryRequirementId);
      }
      continue;
    }

    const tokens = extractRequirementTokens(comment.text);
    if (tokens.length > 0) {
      for (const token of tokens) {
        requirementIds.add(token);
        for (const record of records) {
          if (record.primaryRequirementId.toUpperCase() === token) {
            scenarioIds.add(record.scenarioId);
          }
        }
      }
      continue;
    }

    for (const record of records) {
      if (record.approvalState === 'pending' || record.approvalState === 'needs_revision') {
        scenarioIds.add(record.scenarioId);
        requirementIds.add(record.primaryRequirementId);
      }
    }
  }

  return {
    regenerationScenarioIds: [...scenarioIds].sort((a, b) => a.localeCompare(b)),
    impactedRequirementIds: [...requirementIds].sort((a, b) => a.localeCompare(b))
  };
}
