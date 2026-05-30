import { describe, expect, it } from 'vitest';

import type { ScenarioPlanRecord } from '../../src/pipeline/planning/planContracts';
import { buildPlanReviewBundle, buildScenarioGroupingIndexes } from '../../src/pipeline/planning/scenarioGrouping';

function record(overrides: Partial<ScenarioPlanRecord>): ScenarioPlanRecord {
  return {
    scenarioId: 'scn_default_1',
    scenarioName: 'Default Scenario',
    scope: 'default',
    assertionIntentSummary: 'default',
    primaryRequirementId: 'REQ-1',
    acceptanceCriteriaIds: ['AC-1'],
    riskLevel: 'low',
    riskReason: 'low risk',
    sourceEvidenceIds: [],
    functionality: 'General',
    approvalState: 'pending',
    revisionReason: [],
    commentRefs: [],
    ...overrides
  };
}

describe('scenario grouping indexes', () => {
  it('builds grouped indexes and rejected list', () => {
    const records: ScenarioPlanRecord[] = [
      record({
        scenarioId: 'scn_beta_2',
        scenarioName: 'Beta purchase',
        primaryRequirementId: 'REQ-2',
        acceptanceCriteriaIds: ['AC-2', 'AC-1'],
        functionality: 'Checkout',
        approvalState: 'needs_revision'
      }),
      record({
        scenarioId: 'scn_alpha_1',
        scenarioName: 'Alpha sign in',
        primaryRequirementId: 'REQ-1',
        acceptanceCriteriaIds: ['AC-1'],
        functionality: 'Auth',
        approvalState: 'approved'
      })
    ];

    const grouped = buildScenarioGroupingIndexes(records);

    expect(grouped.byRequirementId).toEqual({
      'REQ-1': ['scn_alpha_1'],
      'REQ-2': ['scn_beta_2']
    });
    expect(grouped.byAcceptanceCriteriaId['AC-1']).toEqual(['scn_alpha_1', 'scn_beta_2']);
    expect(grouped.byFunctionality).toEqual({
      Auth: ['scn_alpha_1'],
      Checkout: ['scn_beta_2']
    });
    expect(grouped.rejectedScenarioIds).toEqual(['scn_beta_2']);
  });

  it('produces deterministic sorted flat list in bundle', () => {
    const bundle = buildPlanReviewBundle([
      record({ scenarioId: 'scn_z', scenarioName: 'Zeta flow', primaryRequirementId: 'REQ-Z' }),
      record({ scenarioId: 'scn_a', scenarioName: 'Alpha flow', primaryRequirementId: 'REQ-A' })
    ]);

    expect(bundle.flatScenarios.map((item) => item.scenarioName)).toEqual(['Alpha flow', 'Zeta flow']);
    expect(bundle.groupIndexes.byRequirementId).toEqual({
      'REQ-A': ['scn_a'],
      'REQ-Z': ['scn_z']
    });
  });
});
