import { describe, expect, it } from 'vitest';

import { createBulkApproveAction, createBulkRejectAction, isReviewActionEnvelope } from '../../src/ui/reviewActions';

describe('review action envelopes', () => {
  it('rejects unknown action types', () => {
    const unknown = {
      type: 'scenario.invalid',
      requestId: 'req_review_1',
      source: 'webview',
      optimisticVersion: 1,
      scenarioId: 'scn_1'
    };

    expect(isReviewActionEnvelope(unknown)).toBe(false);
  });

  it('defaults bulk actions to pending_only mode', () => {
    const approve = createBulkApproveAction('req_review_2', 2);
    const reject = createBulkRejectAction('req_review_2', 3);

    expect(approve.mode).toBe('pending_only');
    expect(reject.mode).toBe('pending_only');
    expect(isReviewActionEnvelope(approve)).toBe(true);
    expect(isReviewActionEnvelope(reject)).toBe(true);
  });

  it('accepts explicit force_override bulk mode', () => {
    const action = createBulkRejectAction('req_review_3', 4, 'webview', 'force_override', 'manual override');

    expect(action.mode).toBe('force_override');
    expect(isReviewActionEnvelope(action)).toBe(true);
  });
});
