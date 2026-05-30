import type { PlanReviewBundle, ScenarioPlanRecord } from './planContracts';

function escapeMarkdownCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').trim();
}

function formatRisk(record: ScenarioPlanRecord): string {
  return `${record.riskLevel.toUpperCase()} - ${record.riskReason}`;
}

function formatAcceptanceCriteriaIds(ids: readonly string[]): string {
  if (ids.length === 0) {
    return '-';
  }

  return ids.join(', ');
}

export function formatPlanChatSummary(bundle: PlanReviewBundle): string {
  const header = [
    '## Scenario Review Plan',
    '',
    `Total scenarios: ${bundle.flatScenarios.length}`,
    '',
    '| Scenario | Scope | Risk | Assertion Intent | Requirement | Acceptance Criteria IDs |',
    '| --- | --- | --- | --- | --- | --- |'
  ];

  const rows = bundle.flatScenarios.map((record) => {
    return `| ${escapeMarkdownCell(record.scenarioName)} | ${escapeMarkdownCell(record.scope)} | ${escapeMarkdownCell(formatRisk(record))} | ${escapeMarkdownCell(record.assertionIntentSummary)} | ${escapeMarkdownCell(record.primaryRequirementId)} | ${escapeMarkdownCell(formatAcceptanceCriteriaIds(record.acceptanceCriteriaIds))} |`;
  });

  const requirementBuckets = Object.keys(bundle.groupIndexes.byRequirementId).length;
  const acceptanceCriteriaBuckets = Object.keys(bundle.groupIndexes.byAcceptanceCriteriaId).length;
  const functionalityBuckets = Object.keys(bundle.groupIndexes.byFunctionality).length;

  const footer = [
    '',
    `Grouped views: requirements (${requirementBuckets}), acceptance criteria (${acceptanceCriteriaBuckets}), functionalities (${functionalityBuckets}).`
  ];

  return [...header, ...rows, ...footer].join('\n');
}
