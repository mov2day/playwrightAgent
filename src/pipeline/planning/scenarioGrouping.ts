import type {
  PlanReviewBundle,
  ScenarioGroupingIndexes,
  ScenarioPlanRecord
} from './planContracts';

function pushUnique(target: Record<string, string[]>, key: string, scenarioId: string): void {
  const scopedKey = key.trim() || 'unassigned';
  const existing = target[scopedKey] ?? [];
  if (!existing.includes(scenarioId)) {
    existing.push(scenarioId);
  }
  target[scopedKey] = existing;
}

function sortIdsWithinGroups(groups: Record<string, string[]>): Record<string, string[]> {
  const sortedEntries = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, scenarioIds]) => [key, [...scenarioIds].sort((a, b) => a.localeCompare(b))] as const);

  return Object.fromEntries(sortedEntries);
}

export function buildScenarioGroupingIndexes(records: readonly ScenarioPlanRecord[]): ScenarioGroupingIndexes {
  const sortedRecords = [...records].sort((a, b) => a.scenarioName.localeCompare(b.scenarioName));
  const byRequirementId: Record<string, string[]> = {};
  const byAcceptanceCriteriaId: Record<string, string[]> = {};
  const byFunctionality: Record<string, string[]> = {};
  const rejectedScenarioIds: string[] = [];

  for (const record of sortedRecords) {
    pushUnique(byRequirementId, record.primaryRequirementId, record.scenarioId);

    for (const acceptanceCriteriaId of record.acceptanceCriteriaIds) {
      pushUnique(byAcceptanceCriteriaId, acceptanceCriteriaId, record.scenarioId);
    }

    pushUnique(byFunctionality, record.functionality, record.scenarioId);

    if (record.approvalState === 'rejected' || record.approvalState === 'needs_revision') {
      rejectedScenarioIds.push(record.scenarioId);
    }
  }

  return {
    byRequirementId: sortIdsWithinGroups(byRequirementId),
    byAcceptanceCriteriaId: sortIdsWithinGroups(byAcceptanceCriteriaId),
    byFunctionality: sortIdsWithinGroups(byFunctionality),
    rejectedScenarioIds: [...rejectedScenarioIds].sort((a, b) => a.localeCompare(b))
  };
}

export function buildPlanReviewBundle(records: readonly ScenarioPlanRecord[]): PlanReviewBundle {
  const flatScenarios = [...records].sort((a, b) => a.scenarioName.localeCompare(b.scenarioName));

  return {
    flatScenarios,
    groupIndexes: buildScenarioGroupingIndexes(flatScenarios)
  };
}
