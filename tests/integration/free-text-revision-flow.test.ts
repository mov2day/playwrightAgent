import { describe, expect, it } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import { buildPlanReviewBundle } from '../../src/pipeline/planning/scenarioGrouping';
import { buildScenarioPlan } from '../../src/pipeline/planning/scenarioMapper';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';
import { handleGateFreeText, handlePlanCommand } from '../../src/participant/handler';

describe('free-text revision loop', () => {
  it('classifies chat comments and routes targeted regeneration', () => {
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-05-31T01:00:00.000Z');
    const orchestrator = new PipelineOrchestrator({ eventSink: sink, now });

    const response = handlePlanCommand('/plan QA-602 auth and checkout', {
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_revision_1',
      now,
      planBundleFactory: () => {
        const scenarios = buildScenarioPlan([
          {
            requirementId: 'PLAN-05',
            acceptanceCriteriaIds: ['AC-5'],
            scenarioName: 'Authentication stable login',
            scope: 'Auth',
            assertionIntentSummary: 'Valid credentials reach dashboard.',
            functionality: 'Authentication',
            riskLevel: 'low',
            riskReason: 'Stable path',
            sourceEvidenceIds: ['jira:QA-602']
          },
          {
            requirementId: 'PLAN-06',
            acceptanceCriteriaIds: ['AC-6'],
            scenarioName: 'Checkout optimistic confirmation',
            scope: 'Checkout',
            assertionIntentSummary: 'Order confirmation appears after payment.',
            functionality: 'Checkout',
            riskLevel: 'medium',
            riskReason: 'Gateway callback timing',
            sourceEvidenceIds: ['jira:QA-602']
          }
        ]);

        return buildPlanReviewBundle(scenarios);
      }
    });

    const scenarioId = response.planScenarios?.[0]?.scenarioId;
    expect(scenarioId).toBeTruthy();

    const recomputed = handleGateFreeText(
      response.requestId,
      `bug: ${scenarioId} fails intermittently on selector lookup`,
      {
        eventSink: sink,
        orchestrator,
        now,
        confidenceInputFactory: () => ({
          componentScores: {
            repo: 75,
            jira: 75,
            confluence: 70,
            user_context: 75
          },
          evidence: [],
          reasons: []
        }),
        planBundleFactory: () => {
          const scenarios = buildScenarioPlan([
            {
              requirementId: 'PLAN-05',
              acceptanceCriteriaIds: ['AC-5'],
              scenarioName: 'Authentication stable login',
              scope: 'Auth',
              assertionIntentSummary: 'Valid credentials reach dashboard.',
              functionality: 'Authentication',
              riskLevel: 'low',
              riskReason: 'Stable path',
              sourceEvidenceIds: ['jira:QA-602']
            },
            {
              requirementId: 'PLAN-06',
              acceptanceCriteriaIds: ['AC-6'],
              scenarioName: 'Checkout optimistic confirmation',
              scope: 'Checkout',
              assertionIntentSummary: 'Order confirmation appears after payment.',
              functionality: 'Checkout',
              riskLevel: 'medium',
              riskReason: 'Gateway callback timing',
              sourceEvidenceIds: ['jira:QA-602']
            }
          ]);

          return buildPlanReviewBundle(scenarios);
        }
      }
    );

    expect(recomputed.decisionGate).toBe('continue');

    const snapshotAfterScenarioComment = orchestrator.getReviewSnapshot(response.requestId);
    expect(snapshotAfterScenarioComment?.regenerationScenarioIds).toContain(scenarioId);

    const scenarioRecord = scenarioId
      ? snapshotAfterScenarioComment?.records[scenarioId]
      : undefined;

    expect(scenarioRecord?.approvalState).toBe('needs_revision');

    handleGateFreeText(
      response.requestId,
      'Please add new context for PLAN-06 around retry constraints',
      {
        eventSink: sink,
        orchestrator,
        now,
        confidenceInputFactory: () => ({
          componentScores: {
            repo: 75,
            jira: 75,
            confluence: 70,
            user_context: 75
          },
          evidence: [],
          reasons: []
        })
      }
    );

    const snapshotAfterGlobalComment = orchestrator.getReviewSnapshot(response.requestId);
    expect(snapshotAfterGlobalComment?.impactedRequirementIds).toContain('PLAN-06');

    const actions = sink.getEvents().map((event) => event.action);
    expect(actions).toContain('review_action_applied');
    expect(actions).toContain('confidence_recomputed_from_free_text');
  });
});
