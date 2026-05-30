import { describe, expect, it } from 'vitest';

import type {
  PlanReviewBundle,
  ScenarioApprovalState,
  ScenarioPlanRecord,
  ScenarioRiskLevel
} from '../../src/pipeline/planning/planContracts';

function createScenarioRecord(overrides: Partial<ScenarioPlanRecord> = {}): ScenarioPlanRecord {
  return {
    scenarioId: 'scn_plan_1',
    scenarioName: 'Checkout flow should submit order',
    scope: 'Checkout',
    assertionIntentSummary: 'Validate cart, shipping, payment, and confirmation.',
    primaryRequirementId: 'PLAN-01',
    acceptanceCriteriaIds: ['AC-1', 'AC-2'],
    riskLevel: 'medium',
    riskReason: 'Payment integration is sensitive.',
    mitigation: 'Use mocked payment gateway.',
    sourceEvidenceIds: ['jira:QA-100'],
    functionality: 'Checkout',
    approvalState: 'pending',
    revisionReason: [],
    commentRefs: [],
    ...overrides
  };
}

describe('plan contracts', () => {
  it('exposes required scenario fields and approval state union', () => {
    const scenario = createScenarioRecord({ approvalState: 'needs_revision' });

    expect(scenario).toMatchObject({
      scenarioId: 'scn_plan_1',
      scenarioName: 'Checkout flow should submit order',
      scope: 'Checkout',
      assertionIntentSummary: 'Validate cart, shipping, payment, and confirmation.',
      primaryRequirementId: 'PLAN-01',
      acceptanceCriteriaIds: ['AC-1', 'AC-2'],
      riskLevel: 'medium',
      riskReason: 'Payment integration is sensitive.',
      sourceEvidenceIds: ['jira:QA-100'],
      approvalState: 'needs_revision',
      revisionReason: [],
      commentRefs: []
    });
  });

  it('supports risk enum values low/medium/high', () => {
    const levels: ScenarioRiskLevel[] = ['low', 'medium', 'high'];
    expect(levels).toEqual(['low', 'medium', 'high']);
  });

  it('supports approval state enum pending/approved/rejected/needs_revision', () => {
    const states: ScenarioApprovalState[] = ['pending', 'approved', 'rejected', 'needs_revision'];
    expect(states).toEqual(['pending', 'approved', 'rejected', 'needs_revision']);
  });

  it('stores flat scenarios and precomputed group indexes in plan bundle', () => {
    const bundle: PlanReviewBundle = {
      flatScenarios: [createScenarioRecord()],
      groupIndexes: {
        byRequirementId: {
          'PLAN-01': ['scn_plan_1']
        },
        byAcceptanceCriteriaId: {
          'AC-1': ['scn_plan_1']
        },
        byFunctionality: {
          Checkout: ['scn_plan_1']
        },
        rejectedScenarioIds: []
      }
    };

    expect(bundle.flatScenarios).toHaveLength(1);
    expect(bundle.groupIndexes.byRequirementId['PLAN-01']).toEqual(['scn_plan_1']);
  });
});
