import type { ReviewSnapshot } from '../orchestrator';
import type { ScenarioPlanRecord } from '../planning/planContracts';

export type GenerationTargetMode = 'approved' | 'regeneration';

export interface BuildGenerationWorksetOptions {
  target?: GenerationTargetMode;
}

export interface GenerationScenarioRecord {
  scenarioId: string;
  scenarioName: string;
  primaryRequirementId: string;
  acceptanceCriteriaIds: string[];
  functionality: string;
  approvalState: 'approved';
  revisionReason: string[];
}

export interface GenerationWorkset {
  requestId: string;
  ackVersion: number;
  target: GenerationTargetMode;
  approvedScenarioIds: readonly string[];
  excludedScenarioIds: readonly string[];
  approvedCount: number;
  excludedCount: number;
  impactedRequirementIds: readonly string[];
  scenarios: readonly GenerationScenarioRecord[];
  scenariosById: Readonly<Record<string, GenerationScenarioRecord>>;
  regenerationScenarioIds: readonly string[];
  regenerationScenarios: readonly GenerationScenarioRecord[];
  generationScenarioIds: readonly string[];
  generationScenarios: readonly GenerationScenarioRecord[];
}

export interface GenerationWorksetInput {
  snapshot: ReviewSnapshot;
  planRecords: readonly ScenarioPlanRecord[];
  options?: BuildGenerationWorksetOptions;
}
