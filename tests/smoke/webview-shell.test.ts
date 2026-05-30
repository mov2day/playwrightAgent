import { describe, expect, it } from 'vitest';

import { PlanReviewShell, renderPlanReviewShell } from '../../src/ui/planReviewShell';

describe('plan review webview shell', () => {
  it('renders request, state, summary, and action controls', () => {
    const html = renderPlanReviewShell({
      requestId: 'req_ui_1',
      state: 'awaiting_plan_approval',
      summary: '3 scenarios mapped to AC-1, AC-2, AC-3',
      actions: ['approve', 'reject', 'continue', 'cancel']
    });

    expect(html).toContain('PlaywrightAgent Plan Review');
    expect(html).toContain('req_ui_1');
    expect(html).toContain('awaiting_plan_approval');
    expect(html).toContain('3 scenarios mapped to AC-1, AC-2, AC-3');
    expect(html).toContain('data-action="approve"');
    expect(html).toContain('data-action="reject"');
    expect(html).toContain('data-action="continue"');
    expect(html).toContain('data-action="cancel"');
  });

  it('stores last payload when opening shell', () => {
    const shell = new PlanReviewShell();
    const html = shell.open({
      requestId: 'req_ui_2',
      state: 'ready_to_write',
      summary: 'approved script preview',
      actions: ['continue', 'cancel']
    });

    expect(html).toContain('req_ui_2');
    expect(shell.getLastPayload()).toMatchObject({
      requestId: 'req_ui_2',
      state: 'ready_to_write'
    });
  });
});
