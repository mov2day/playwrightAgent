import type { ScenarioPlanRecord, ScenarioRiskLevel } from './planContracts';

export interface RequirementScenarioInput {
  requirementId: string;
  acceptanceCriteriaIds: string[];
  scenarioName: string;
  scope: string;
  assertionIntentSummary: string;
  functionality?: string;
  riskLevel?: ScenarioRiskLevel;
  riskReason?: string;
  mitigation?: string;
  sourceEvidenceIds?: string[];
}

export interface BuildScenarioPlanOptions {
  defaultRiskLevel?: ScenarioRiskLevel;
  defaultRiskReason?: string;
}

function normalizeRequirementToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

function normalizeAcceptanceCriteria(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const candidate of ids) {
    const trimmed = candidate.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function buildScenarioPlan(
  requirementContext: readonly RequirementScenarioInput[],
  options: BuildScenarioPlanOptions = {}
): ScenarioPlanRecord[] {
  const defaultRiskLevel = options.defaultRiskLevel ?? 'medium';
  const defaultRiskReason = options.defaultRiskReason ?? 'Context confidence requires reviewer confirmation.';

  return requirementContext
    .filter((item) => Boolean(item.requirementId.trim()) && Boolean(item.scenarioName.trim()))
    .map((item, index) => {
      const requirementToken = normalizeRequirementToken(item.requirementId);
      const scenarioId = `scn_${requirementToken}_${index + 1}`;

      return {
        scenarioId,
        scenarioName: item.scenarioName.trim(),
        scope: item.scope.trim() || 'End-to-end scenario validation',
        assertionIntentSummary: item.assertionIntentSummary.trim() || 'Validate expected behavior for reviewed scope.',
        primaryRequirementId: item.requirementId.trim(),
        acceptanceCriteriaIds: normalizeAcceptanceCriteria(item.acceptanceCriteriaIds),
        riskLevel: item.riskLevel ?? defaultRiskLevel,
        riskReason: item.riskReason?.trim() || defaultRiskReason,
        mitigation: item.mitigation?.trim() || undefined,
        sourceEvidenceIds: normalizeAcceptanceCriteria(item.sourceEvidenceIds ?? []),
        functionality: item.functionality?.trim() || 'General',
        approvalState: 'pending',
        revisionReason: [],
        commentRefs: []
      };
    });
}
