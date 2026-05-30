import { describe, expect, it } from 'vitest';

import { computeApprovedScope, computeRegenerationTargets, type ApprovalScopeRecord } from '../../src/pipeline/planning/approvalScope';

const RECORDS: ApprovalScopeRecord[] = [
  {
    scenarioId: 'scn_plan_1',
    primaryRequirementId: 'PLAN-01',
    acceptanceCriteriaIds: ['AC-1'],
    approvalState: 'approved'
  },
  {
    scenarioId: 'scn_plan_2',
    primaryRequirementId: 'PLAN-02',
    acceptanceCriteriaIds: ['AC-2'],
    approvalState: 'needs_revision'
  },
  {
    scenarioId: 'scn_plan_3',
    primaryRequirementId: 'PLAN-03',
    acceptanceCriteriaIds: ['AC-3'],
    approvalState: 'pending'
  }
];

describe('approval scope selectors', () => {
  it('includes only approved scenarios in generation scope', () => {
    const scope = computeApprovedScope(RECORDS);

    expect(scope.approvedScenarioIds).toEqual(['scn_plan_1']);
    expect(scope.excludedScenarioIds).toEqual(['scn_plan_2', 'scn_plan_3']);
    expect(scope.approvedCount).toBe(1);
    expect(scope.excludedCount).toBe(2);
  });

  it('computes targeted regeneration candidates from comments', () => {
    const targets = computeRegenerationTargets(RECORDS, [
      {
        target: 'scenario',
        classification: 'bug',
        scenarioId: 'scn_plan_2',
        text: 'scn_plan_2 has flaky selector'
      },
      {
        target: 'global',
        classification: 'new_context',
        text: 'Please update PLAN-03 flows with new discount rule'
      }
    ]);

    expect(targets.regenerationScenarioIds).toEqual(['scn_plan_2', 'scn_plan_3']);
    expect(targets.impactedRequirementIds).toEqual(['PLAN-02', 'PLAN-03']);
  });
});
