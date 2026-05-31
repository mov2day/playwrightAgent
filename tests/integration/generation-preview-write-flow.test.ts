import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import { buildPlanReviewBundle } from '../../src/pipeline/planning/scenarioGrouping';
import { buildScenarioPlan } from '../../src/pipeline/planning/scenarioMapper';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';
import { handlePlanCommand, handlePreviewApproveAll } from '../../src/participant/handler';
import { createPreviewApproveAllAction } from '../../src/ui/previewActions';

const TEMP_DIRS: string[] = [];

function makeTempWriteRoot(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwagent-writer-'));
  TEMP_DIRS.push(rootDir);
  return rootDir;
}

function writeFixture(rootDir: string, relativePath: string, contents: string): void {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents, 'utf8');
}

function readFixture(rootDir: string, relativePath: string): string {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

afterEach(() => {
  for (const tempDir of TEMP_DIRS) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  TEMP_DIRS.length = 0;
});

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

  it('executes surgical write plan with patch, create fallback, and skip outcomes', () => {
    const rootDir = makeTempWriteRoot();
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-05-31T03:00:00.000Z');
    const requestId = 'req_preview_write_3';
    const fallbackFile = 'tests/e2e/checkout.pwagent.generated.spec.ts';

    writeFixture(rootDir, 'tests/e2e/auth.spec.ts', [
      'import { test } from \'@playwright/test\';',
      '',
      'describe(\'Auth flow\', () => {',
      '  test(\'manual user-authored stays\', async ({ page }) => {',
      '    await page.goto(\'/login\');',
      '  });',
      '',
      '  // @pwagent:begin:pwagent_auth_flow',
      '  test(\'legacy generated block\', async ({ page }) => {',
      '    await page.goto(\'/legacy\');',
      '  });',
      '  // @pwagent:end:pwagent_auth_flow',
      '});'
    ].join('\n'));
    writeFixture(rootDir, 'tests/e2e/checkout.spec.ts', [
      'import { test } from \'@playwright/test\';',
      '',
      'describe(\'Other flow\', () => {',
      '  test(\'manual checkout case\', async ({ page }) => {',
      '    await page.goto(\'/checkout\');',
      '  });',
      '});'
    ].join('\n'));
    writeFixture(rootDir, 'tests/e2e/cart.spec.ts', [
      'describe(\'Cart flow\', () => {',
      '  // @pwagent:begin:pwagent_cart_flow',
      '  test(\'legacy cart generated\', async () => {});',
      '});'
    ].join('\n'));

    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now,
      rootDir,
      stageEntryGateEvaluator: (stage) => ({
        stage,
        blocked: false,
        fail_closed: false,
        requires_user_decision: false,
        reasons: [],
        manifest_hash: 'writer-test'
      })
    });
    orchestrator.startSession(requestId, 'ready_to_write');
    expect(orchestrator.applyPreviewAction(requestId, createPreviewApproveAllAction(
      requestId,
      1,
      'chat',
      'preview.v1'
    )).ok).toBe(true);

    const result = orchestrator.executeWritePlan(requestId, [
      {
        targetPath: 'tests/e2e/auth.spec.ts',
        mode: 'patch_existing',
        scenarioIds: ['scn_auth_1'],
        describeName: 'Auth flow',
        markerBegin: '// @pwagent:begin:pwagent_auth_flow',
        markerEnd: '// @pwagent:end:pwagent_auth_flow',
        generatedBlock: [
          '// @pwagent:begin:pwagent_auth_flow',
          'test(\'new generated auth\', async ({ page }) => {',
          '  await page.goto(\'/auth\');',
          '});',
          '// @pwagent:end:pwagent_auth_flow'
        ].join('\n'),
        anchorConfidence: 0.95
      },
      {
        targetPath: 'tests/e2e/checkout.spec.ts',
        mode: 'patch_existing',
        scenarioIds: ['scn_checkout_1'],
        describeName: 'Checkout flow',
        markerBegin: '// @pwagent:begin:pwagent_checkout_flow',
        markerEnd: '// @pwagent:end:pwagent_checkout_flow',
        generatedBlock: [
          '// @pwagent:begin:pwagent_checkout_flow',
          'test(\'new checkout generated\', async ({ page }) => {',
          '  await page.goto(\'/checkout/new\');',
          '});',
          '// @pwagent:end:pwagent_checkout_flow'
        ].join('\n'),
        anchorConfidence: 0.95
      },
      {
        targetPath: 'tests/e2e/cart.spec.ts',
        mode: 'patch_existing',
        scenarioIds: ['scn_cart_1'],
        describeName: 'Cart flow',
        markerBegin: '// @pwagent:begin:pwagent_cart_flow',
        markerEnd: '// @pwagent:end:pwagent_cart_flow',
        generatedBlock: [
          '// @pwagent:begin:pwagent_cart_flow',
          'test(\'new cart generated\', async () => {});',
          '// @pwagent:end:pwagent_cart_flow'
        ].join('\n'),
        anchorConfidence: 0.95
      }
    ]);

    expect(result.ok).toBe(true);
    expect(result.to).toBe('completed');
    expect(result.report?.summary).toEqual({
      total: 3,
      patched: 1,
      created: 1,
      skipped: 1
    });
    expect(result.report?.outcomes.map((outcome) => outcome.status)).toEqual(['patched', 'created', 'skipped']);
    expect(result.report?.outcomes[2]?.reason).toBe('marker_mismatch');

    const authFile = readFixture(rootDir, 'tests/e2e/auth.spec.ts');
    expect(authFile).toContain('manual user-authored stays');
    expect(authFile).not.toContain('legacy generated block');
    expect(authFile).toContain('new generated auth');

    const originalCheckout = readFixture(rootDir, 'tests/e2e/checkout.spec.ts');
    expect(originalCheckout).not.toContain('new checkout generated');
    const scopedCheckout = readFixture(rootDir, fallbackFile);
    expect(scopedCheckout).toContain('new checkout generated');

    const cartFile = readFixture(rootDir, 'tests/e2e/cart.spec.ts');
    expect(cartFile).toContain('legacy cart generated');
    expect(cartFile).not.toContain('new cart generated');
  });
});
