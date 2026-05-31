import { describe, expect, it } from 'vitest';

import { evaluateAnchorSafety } from '../../src/pipeline/writer/anchorSafety';
import { buildWriteReportSummary } from '../../src/pipeline/writer/writeReport';
import { WRITER_MODES, createWritePlanEntry, type WriteOutcome } from '../../src/pipeline/writer/writeContracts';

describe('writer anchor safety and report contracts', () => {
  it('aligns canonical writer modes with placement contracts plus skip fallback', () => {
    expect(WRITER_MODES).toEqual(['patch_existing', 'create_scoped', 'skip']);

    const plan = createWritePlanEntry({
      targetPath: 'tests/generated/auth.spec.ts',
      mode: 'skip',
      scenarioIds: ['scn_auth_1'],
      generatedBlock: 'test("auth")'
    });

    expect(plan.mode).toBe('skip');
  });

  it('emits explicit unsafe reason codes for anchor checks', () => {
    const missingAnchor = evaluateAnchorSafety({
      mode: 'patch_existing',
      targetPath: 'tests/e2e/auth.spec.ts',
      existingContent: '',
      describeName: 'Auth flow',
      markerBegin: '@pwagent:begin:scn_auth_1',
      markerEnd: '@pwagent:end:scn_auth_1',
      confidence: 0.95
    });

    expect(missingAnchor.safe).toBe(false);
    expect(missingAnchor.reason).toBe('missing_anchor');
    expect(missingAnchor.fallbackMode).toBe('create_scoped');

    const describeNotFound = evaluateAnchorSafety({
      mode: 'patch_existing',
      targetPath: 'tests/e2e/checkout.spec.ts',
      existingContent: 'describe("Other flow", () => {});',
      describeName: 'Checkout flow',
      markerBegin: '@pwagent:begin:scn_checkout_1',
      markerEnd: '@pwagent:end:scn_checkout_1',
      confidence: 0.95
    });

    expect(describeNotFound.safe).toBe(false);
    expect(describeNotFound.reason).toBe('describe_not_found');
    expect(describeNotFound.fallbackMode).toBe('create_scoped');

    const markerMismatch = evaluateAnchorSafety({
      mode: 'patch_existing',
      targetPath: 'tests/e2e/cart.spec.ts',
      existingContent: [
        'describe("Cart flow", () => {',
        '  // @pwagent:begin:scn_cart_1',
        '  test("old generated", () => {});',
        '});'
      ].join('\n'),
      describeName: 'Cart flow',
      markerBegin: '@pwagent:begin:scn_cart_1',
      markerEnd: '@pwagent:end:scn_cart_1',
      confidence: 0.95
    });

    expect(markerMismatch.safe).toBe(false);
    expect(markerMismatch.reason).toBe('marker_mismatch');
    expect(markerMismatch.fallbackMode).toBe('skip');

    const lowConfidence = evaluateAnchorSafety({
      mode: 'patch_existing',
      targetPath: 'tests/e2e/profile.spec.ts',
      existingContent: 'describe("Profile flow", () => {});',
      describeName: 'Profile flow',
      markerBegin: '@pwagent:begin:scn_profile_1',
      markerEnd: '@pwagent:end:scn_profile_1',
      confidence: 0.1
    });

    expect(lowConfidence.safe).toBe(false);
    expect(lowConfidence.reason).toBe('unsafe');
    expect(lowConfidence.fallbackMode).toBe('create_scoped');
  });

  it('builds mixed outcome report with patched, created, and skipped counts', () => {
    const outcomes: WriteOutcome[] = [
      {
        targetPath: 'tests/e2e/auth.spec.ts',
        mode: 'patch_existing',
        status: 'patched',
        noDelete: true,
        preserveExisting: true
      },
      {
        targetPath: 'tests/e2e/checkout.spec.ts',
        mode: 'create_scoped',
        status: 'created',
        noDelete: true,
        preserveExisting: true
      },
      {
        targetPath: 'tests/e2e/cart.spec.ts',
        mode: 'skip',
        status: 'skipped',
        reason: 'marker_mismatch',
        noDelete: true,
        preserveExisting: true
      }
    ];

    const report = buildWriteReportSummary('req_write_1', 'preview.req_write_1.v3', outcomes);

    expect(report.summary.patched).toBe(1);
    expect(report.summary.created).toBe(1);
    expect(report.summary.skipped).toBe(1);
    expect(report.outcomes[2]?.reason).toBe('marker_mismatch');
  });
});
