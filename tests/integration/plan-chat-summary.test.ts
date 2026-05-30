import { describe, expect, it } from 'vitest';

import { buildPlanReviewBundle } from '../../src/pipeline/planning/scenarioGrouping';
import { buildScenarioPlan } from '../../src/pipeline/planning/scenarioMapper';
import { handlePlanCommand } from '../../src/participant/handler';

describe('plan chat summary payload', () => {
  it('includes structured summary text and scenario records in response payload', () => {
    const response = handlePlanCommand('/plan QA-500 checkout and retry policy', {
      requestIdFactory: () => 'req_plan_summary_1',
      now: () => new Date('2026-05-31T00:00:00.000Z'),
      planBundleFactory: () => {
        const scenarios = buildScenarioPlan([
          {
            requirementId: 'PLAN-01',
            acceptanceCriteriaIds: ['AC-1', 'AC-2'],
            scenarioName: 'Checkout success path',
            scope: 'Checkout flow',
            assertionIntentSummary: 'Confirm user can complete purchase with valid card.',
            functionality: 'Checkout',
            riskLevel: 'medium',
            riskReason: 'Payment and order creation depend on multiple services.',
            sourceEvidenceIds: ['jira:QA-500']
          }
        ]);

        return buildPlanReviewBundle(scenarios);
      }
    });

    expect(response.planSummary).toContain('## Scenario Review Plan');
    expect(response.planSummary).toContain('Scenario');
    expect(response.planSummary).toContain('Scope');
    expect(response.planSummary).toContain('Risk');
    expect(response.planSummary).toContain('Assertion Intent');
    expect(response.planSummary).toContain('Requirement');
    expect(response.planSummary).toContain('Acceptance Criteria IDs');

    expect(response.planScenarios).toHaveLength(1);
    expect(response.planScenarios?.[0]).toMatchObject({
      scenarioName: 'Checkout success path',
      primaryRequirementId: 'PLAN-01',
      acceptanceCriteriaIds: ['AC-1', 'AC-2'],
      assertionIntentSummary: 'Confirm user can complete purchase with valid card.'
    });
  });
});
