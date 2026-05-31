import { describe, expect, it } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import { buildPlanReviewBundle } from '../../src/pipeline/planning/scenarioGrouping';
import { buildScenarioPlan } from '../../src/pipeline/planning/scenarioMapper';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';
import { handlePlanCommand, handlePreviewApproveAll } from '../../src/participant/handler';
import { createPreviewApproveAllAction } from '../../src/ui/previewActions';

function createPlanBundle() {
  const scenarios = buildScenarioPlan([
    {
      requirementId: 'PLAN-41',
      acceptanceCriteriaIds: ['AC-41'],
      scenarioName: 'Authentication stable login',
      scope: 'Auth',
      assertionIntentSummary: 'Valid credentials reach dashboard.',
      functionality: 'Authentication',
      riskLevel: 'low',
      riskReason: 'Stable path',
      sourceEvidenceIds: ['jira:QA-701']
    },
    {
      requirementId: 'PLAN-42',
      acceptanceCriteriaIds: ['AC-42'],
      scenarioName: 'Checkout retry path',
      scope: 'Checkout',
      assertionIntentSummary: 'Retry succeeds after gateway timeout.',
      functionality: 'Checkout',
      riskLevel: 'medium',
      riskReason: 'Async callback timing',
      sourceEvidenceIds: ['jira:QA-701']
    }
  ]);

  return buildPlanReviewBundle(scenarios);
}

describe('generation preview write flow', () => {
  it('unlocks write only after explicit approve_all for active previewVersion', () => {
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-05-31T02:00:00.000Z');
    const orchestrator = new PipelineOrchestrator({ eventSink: sink, now });

    const response = handlePlanCommand('/plan QA-701 auth + checkout flow', {
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_preview_write_1',
      now,
      planBundleFactory: createPlanBundle
    });

    expect(orchestrator.handleQuickAction(response.requestId, 'approve').ok).toBe(true);
    expect(orchestrator.handleQuickAction(response.requestId, 'continue').ok).toBe(true);
    expect(orchestrator.handleQuickAction(response.requestId, 'approve').ok).toBe(true);

    expect(orchestrator.setPreviewVersion(response.requestId, 'preview.req_preview_write_1.v1')).toBe(true);

    const blockedContinue = orchestrator.handleQuickAction(response.requestId, 'continue');
    expect(blockedContinue.ok).toBe(false);
    expect(blockedContinue.errorCode).toBe('PREVIEW_APPROVAL_REQUIRED');

    const mismatchedApprove = orchestrator.applyPreviewAction(
      response.requestId,
      createPreviewApproveAllAction(
        response.requestId,
        1,
        'webview',
        'preview.req_preview_write_1.v0'
      )
    );
    expect(mismatchedApprove.ok).toBe(false);
    expect(mismatchedApprove.errorCode).toBe('PREVIEW_VERSION_MISMATCH');

    const approved = handlePreviewApproveAll(response.requestId, 'preview.req_preview_write_1.v1', {
      orchestrator,
      now
    });

    expect(approved.ok).toBe(true);

    const continueToWrite = orchestrator.handleQuickAction(response.requestId, 'continue');
    expect(continueToWrite.ok).toBe(true);
    expect(orchestrator.getSession(response.requestId)?.state).toBe('ready_to_write');
  });

  it('content-changing comments invalidate approval and keep regeneration IDs deterministic', () => {
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-05-31T02:30:00.000Z');
    const orchestrator = new PipelineOrchestrator({ eventSink: sink, now });

    const response = handlePlanCommand('/plan QA-702 preview invalidation loop', {
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_preview_write_2',
      now,
      planBundleFactory: createPlanBundle
    });

    const scenarioId = response.planScenarios?.[0]?.scenarioId;
    expect(scenarioId).toBeTruthy();

    expect(orchestrator.handleQuickAction(response.requestId, 'approve').ok).toBe(true);
    expect(orchestrator.handleQuickAction(response.requestId, 'continue').ok).toBe(true);
    expect(orchestrator.handleQuickAction(response.requestId, 'approve').ok).toBe(true);
    expect(orchestrator.setPreviewVersion(response.requestId, 'preview.req_preview_write_2.v1')).toBe(true);

    const approved = handlePreviewApproveAll(response.requestId, 'preview.req_preview_write_2.v1', {
      orchestrator,
      now
    });
    expect(approved.ok).toBe(true);

    const beforeComment = orchestrator.getReviewSnapshot(response.requestId);
    expect(beforeComment?.previewVersion).toBe('preview.req_preview_write_2.v1');
    expect(beforeComment?.approvedPreviewVersion).toBe('preview.req_preview_write_2.v1');
    expect(beforeComment?.writeApprovalRequired).toBe(false);

    const comment = orchestrator.applyScenarioAction(response.requestId, {
      type: 'comment.add',
      requestId: response.requestId,
      source: 'chat',
      optimisticVersion: 2,
      target: 'scenario',
      scenarioId: scenarioId as string,
      classification: 'bug',
      text: `bug: ${scenarioId} flaky selector`
    });
    expect(comment.ok).toBe(true);

    const afterComment = orchestrator.getReviewSnapshot(response.requestId);
    expect(afterComment?.previewVersion).not.toBe(beforeComment?.previewVersion);
    expect(afterComment?.approvedPreviewVersion).toBeUndefined();
    expect(afterComment?.writeApprovalRequired).toBe(true);
    expect(afterComment?.regenerationScenarioIds).toEqual([scenarioId]);
    expect(afterComment?.impactedRequirementIds).toEqual(['PLAN-41']);

    const replaySnapshot = orchestrator.getReviewSnapshot(response.requestId);
    expect(replaySnapshot?.regenerationScenarioIds).toEqual(afterComment?.regenerationScenarioIds);
    expect(replaySnapshot?.impactedRequirementIds).toEqual(afterComment?.impactedRequirementIds);

    const blockedContinue = orchestrator.handleQuickAction(response.requestId, 'continue');
    expect(blockedContinue.ok).toBe(false);
    expect(blockedContinue.errorCode).toBe('PREVIEW_APPROVAL_REQUIRED');
  });
});
