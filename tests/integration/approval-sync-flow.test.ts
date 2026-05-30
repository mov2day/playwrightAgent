import { describe, expect, it } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import { buildPlanReviewBundle } from '../../src/pipeline/planning/scenarioGrouping';
import { buildScenarioPlan } from '../../src/pipeline/planning/scenarioMapper';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';
import { handlePlanCommand } from '../../src/participant/handler';

describe('approval synchronization flow', () => {
  it('keeps one orchestrator source of truth for per-scenario and bulk approvals', () => {
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-05-31T00:00:00.000Z');
    const orchestrator = new PipelineOrchestrator({ eventSink: sink, now });

    const response = handlePlanCommand('/plan QA-601 checkout flow', {
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_sync_1',
      now,
      planBundleFactory: () => {
        const scenarios = buildScenarioPlan([
          {
            requirementId: 'PLAN-04',
            acceptanceCriteriaIds: ['AC-1'],
            scenarioName: 'Checkout happy path',
            scope: 'Checkout',
            assertionIntentSummary: 'Valid card completes order.',
            functionality: 'Checkout',
            riskLevel: 'medium',
            riskReason: 'Payment dependency',
            sourceEvidenceIds: ['jira:QA-601']
          },
          {
            requirementId: 'PLAN-05',
            acceptanceCriteriaIds: ['AC-2'],
            scenarioName: 'Checkout retry path',
            scope: 'Checkout',
            assertionIntentSummary: 'Retry succeeds after network failure.',
            functionality: 'Checkout',
            riskLevel: 'high',
            riskReason: 'Flaky network behavior',
            sourceEvidenceIds: ['jira:QA-601']
          }
        ]);

        return buildPlanReviewBundle(scenarios);
      }
    });

    const seededSnapshot = orchestrator.getReviewSnapshot(response.requestId);
    expect(seededSnapshot?.approvedCount).toBe(0);
    expect(seededSnapshot?.excludedCount).toBe(2);

    const firstScenarioId = seededSnapshot?.records[Object.keys(seededSnapshot.records)[0] ?? '']?.scenarioId;
    expect(firstScenarioId).toBeTruthy();

    const approveResult = orchestrator.applyScenarioAction(response.requestId, {
      type: 'scenario.approve',
      requestId: response.requestId,
      source: 'webview',
      optimisticVersion: 1,
      scenarioId: firstScenarioId as string
    });

    expect(approveResult.ok).toBe(true);
    expect(approveResult.ackVersion).toBe(1);
    expect(approveResult.reviewSnapshot?.approvedCount).toBe(1);

    const bulkRejectResult = orchestrator.applyScenarioAction(response.requestId, {
      type: 'bulk.reject',
      requestId: response.requestId,
      source: 'chat',
      optimisticVersion: 2,
      mode: 'pending_only',
      reason: 'Needs deeper validation before generation'
    });

    expect(bulkRejectResult.ok).toBe(true);
    expect(bulkRejectResult.ackVersion).toBe(2);

    const finalSnapshot = orchestrator.getReviewSnapshot(response.requestId);
    expect(finalSnapshot?.approvedCount).toBe(1);
    expect(finalSnapshot?.excludedCount).toBe(1);

    const values = Object.values(finalSnapshot?.records ?? {});
    const approved = values.filter((record) => record.approvalState === 'approved');
    const needsRevision = values.filter((record) => record.approvalState === 'needs_revision');

    expect(approved).toHaveLength(1);
    expect(needsRevision).toHaveLength(1);
  });
});
