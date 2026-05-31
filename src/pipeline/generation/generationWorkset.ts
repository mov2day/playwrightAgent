import type { ReviewSnapshot } from '../orchestrator';
import type { ScenarioPlanRecord } from '../planning/planContracts';
import type {
  BuildGenerationWorksetOptions,
  GenerationScenarioRecord,
  GenerationTargetMode,
  GenerationWorkset
} from './generationContracts';

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function toGenerationScenario(record: ScenarioPlanRecord): GenerationScenarioRecord {
  return Object.freeze({
    scenarioId: record.scenarioId,
    scenarioName: record.scenarioName,
    primaryRequirementId: record.primaryRequirementId,
    acceptanceCriteriaIds: [...record.acceptanceCriteriaIds],
    functionality: record.functionality,
    approvalState: 'approved' as const,
    revisionReason: [...record.revisionReason]
  });
}

export function buildGenerationWorkset(
  snapshot: ReviewSnapshot,
  planRecords: readonly ScenarioPlanRecord[],
  options: BuildGenerationWorksetOptions = {}
): GenerationWorkset {
  const mode: GenerationTargetMode = options.target ?? 'approved';
  const recordsByScenarioId = new Map(planRecords.map((record) => [record.scenarioId, record]));

  const approvedScenarioIds = uniqueSorted(
    snapshot.approvedScenarioIds.filter((scenarioId) => {
      const record = recordsByScenarioId.get(scenarioId);
      return record?.approvalState === 'approved';
    })
  );

  const scenarios = approvedScenarioIds
    .map((scenarioId) => recordsByScenarioId.get(scenarioId))
    .filter((record): record is ScenarioPlanRecord => Boolean(record) && record.approvalState === 'approved')
    .map((record) => toGenerationScenario(record));

  const excludedFromPlanRecords = planRecords
    .filter((record) => record.approvalState !== 'approved')
    .map((record) => record.scenarioId);

  const excludedScenarioIds = uniqueSorted([
    ...snapshot.excludedScenarioIds,
    ...excludedFromPlanRecords
  ]);

  const approvedSet = new Set(approvedScenarioIds);
  const regenerationScenarioIds = uniqueSorted(
    snapshot.regenerationScenarioIds.filter((scenarioId) => approvedSet.has(scenarioId))
  );
  const regenerationScenarios = scenarios.filter((scenario) => regenerationScenarioIds.includes(scenario.scenarioId));

  const generationScenarioIds = mode === 'regeneration'
    ? regenerationScenarioIds
    : approvedScenarioIds;
  const generationScenarios = mode === 'regeneration'
    ? regenerationScenarios
    : scenarios;

  const scenariosById: Record<string, GenerationScenarioRecord> = {};
  for (const scenario of scenarios) {
    scenariosById[scenario.scenarioId] = scenario;
  }

  return Object.freeze({
    requestId: snapshot.requestId,
    ackVersion: snapshot.ackVersion,
    target: mode,
    approvedScenarioIds: Object.freeze(approvedScenarioIds),
    excludedScenarioIds: Object.freeze(excludedScenarioIds),
    approvedCount: approvedScenarioIds.length,
    excludedCount: excludedScenarioIds.length,
    impactedRequirementIds: Object.freeze(uniqueSorted(snapshot.impactedRequirementIds)),
    scenarios: Object.freeze([...scenarios]),
    scenariosById: Object.freeze(scenariosById),
    regenerationScenarioIds: Object.freeze(regenerationScenarioIds),
    regenerationScenarios: Object.freeze([...regenerationScenarios]),
    generationScenarioIds: Object.freeze([...generationScenarioIds]),
    generationScenarios: Object.freeze([...generationScenarios])
  });
}
