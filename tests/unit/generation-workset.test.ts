import { describe, expect, it } from 'vitest';

import type { ReviewSnapshot } from '../../src/pipeline/orchestrator';
import { buildGenerationWorkset } from '../../src/pipeline/generation/generationWorkset';
import type { ScenarioPlanRecord } from '../../src/pipeline/planning/planContracts';

function planRecord(overrides: Partial<ScenarioPlanRecord>): ScenarioPlanRecord {
  return {
    scenarioId: 'scn_default_1',
    scenarioName: 'Default scenario',
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

function reviewSnapshot(overrides: Partial<ReviewSnapshot>): ReviewSnapshot {
  return {
    requestId: 'req-1',
    ackVersion: 3,
    previewVersion: 'preview.v1',
    approvedPreviewVersion: undefined,
    writeApprovalRequired: true,
    approvedScenarioIds: [],
    excludedScenarioIds: [],
    approvedCount: 0,
    excludedCount: 0,
    regenerationScenarioIds: [],
    impactedRequirementIds: [],
    records: {},
    ...overrides
  };
}

describe('buildGenerationWorkset', () => {
  it('keeps only approved scenarios with deterministic ordering', () => {
    const records = [
      planRecord({
        scenarioId: 'scn_checkout_1',
        scenarioName: 'Checkout: happy path',
        functionality: 'Checkout',
        primaryRequirementId: 'REQ-2',
        approvalState: 'approved'
      }),
      planRecord({
        scenarioId: 'scn_pending_1',
        scenarioName: 'Checkout: pending',
        functionality: 'Checkout',
        primaryRequirementId: 'REQ-3',
        approvalState: 'pending'
      }),
      planRecord({
        scenarioId: 'scn_auth_1',
        scenarioName: 'Auth: sign in',
        functionality: 'Auth',
        primaryRequirementId: 'REQ-1',
        approvalState: 'approved'
      })
    ];

    const workset = buildGenerationWorkset(
      reviewSnapshot({
        approvedScenarioIds: ['scn_pending_1', 'scn_checkout_1', 'scn_auth_1']
      }),
      records
    );

    expect(workset.approvedScenarioIds).toEqual(['scn_auth_1', 'scn_checkout_1']);
    expect(workset.scenarios.map((item) => item.scenarioId)).toEqual(['scn_auth_1', 'scn_checkout_1']);
    expect(workset.scenarios.every((item) => item.approvalState === 'approved')).toBe(true);
  });

  it('reports excluded scenario ids and counts for auditability', () => {
    const records = [
      planRecord({ scenarioId: 'scn_alpha_1', approvalState: 'approved' }),
      planRecord({ scenarioId: 'scn_beta_2', approvalState: 'needs_revision' }),
      planRecord({ scenarioId: 'scn_gamma_3', approvalState: 'rejected' })
    ];

    const workset = buildGenerationWorkset(
      reviewSnapshot({
        approvedScenarioIds: ['scn_alpha_1'],
        excludedScenarioIds: ['scn_gamma_3']
      }),
      records
    );

    expect(workset.excludedScenarioIds).toEqual(['scn_beta_2', 'scn_gamma_3']);
    expect(workset.excludedCount).toBe(2);
  });

  it('surfaces regeneration subset without widening generation scope', () => {
    const records = [
      planRecord({ scenarioId: 'scn_auth_1', primaryRequirementId: 'REQ-1', approvalState: 'approved' }),
      planRecord({ scenarioId: 'scn_checkout_1', primaryRequirementId: 'REQ-2', approvalState: 'approved' }),
      planRecord({ scenarioId: 'scn_pending_1', primaryRequirementId: 'REQ-3', approvalState: 'pending' })
    ];

    const workset = buildGenerationWorkset(
      reviewSnapshot({
        approvedScenarioIds: ['scn_checkout_1', 'scn_auth_1'],
        regenerationScenarioIds: ['scn_pending_1', 'scn_auth_1'],
        impactedRequirementIds: ['REQ-3', 'REQ-1']
      }),
      records,
      { target: 'regeneration' }
    );

    expect(workset.regenerationScenarioIds).toEqual(['scn_auth_1']);
    expect(workset.generationScenarioIds).toEqual(['scn_auth_1']);
    expect(workset.regenerationScenarios.map((item) => item.scenarioId)).toEqual(['scn_auth_1']);
  });
});
