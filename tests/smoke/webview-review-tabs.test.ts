import { describe, expect, it } from 'vitest';

import { buildPlanReviewBundle } from '../../src/pipeline/planning/scenarioGrouping';
import { buildScenarioPlan } from '../../src/pipeline/planning/scenarioMapper';
import { buildReviewViewModel } from '../../src/ui/reviewModel';
import { renderReviewAppToHtml } from '../../src/ui/reviewApp';

describe('review app grouped tabs and actions', () => {
  it('renders required tabs and per-scenario/bulk action controls', () => {
    const scenarios = buildScenarioPlan([
      {
        requirementId: 'PLAN-03',
        acceptanceCriteriaIds: ['AC-1'],
        scenarioName: 'Auth login success',
        scope: 'Auth flow',
        assertionIntentSummary: 'Verify valid credentials can login.',
        functionality: 'Authentication',
        riskLevel: 'low',
        riskReason: 'Simple path',
        sourceEvidenceIds: ['ctx_1']
      },
      {
        requirementId: 'PLAN-04',
        acceptanceCriteriaIds: ['AC-2'],
        scenarioName: 'Checkout capture order',
        scope: 'Checkout flow',
        assertionIntentSummary: 'Verify order confirmation after payment.',
        functionality: 'Checkout',
        riskLevel: 'medium',
        riskReason: 'Depends on payment confirmation',
        sourceEvidenceIds: ['ctx_2']
      }
    ]);

    const rejected = scenarios[1];
    if (rejected) {
      rejected.approvalState = 'needs_revision';
      rejected.revisionReason.push('Need explicit retries');
    }

    const model = buildReviewViewModel({
      requestId: 'req_ui_tabs_1',
      state: 'awaiting_plan_approval',
      bundle: buildPlanReviewBundle(scenarios),
      availableActions: ['approve', 'reject', 'continue', 'cancel'],
      activeTabId: 'all'
    });

    const html = renderReviewAppToHtml(model);

    expect(html).toContain('data-tab="all"');
    expect(html).toContain('data-tab="by_requirement"');
    expect(html).toContain('data-tab="by_acceptance_criteria"');
    expect(html).toContain('data-tab="by_functionality"');
    expect(html).toContain('data-tab="rejected"');

    expect(html).toContain('data-action="scenario.approve"');
    expect(html).toContain('data-action="scenario.reject"');
    expect(html).toContain('data-action="scenario.revise"');
    expect(html).toContain('data-action="bulk.approve"');
    expect(html).toContain('data-action="bulk.reject"');
    expect(html).toContain('data-target="global"');
    expect(html).toContain('data-target="scenario"');
  });
});
