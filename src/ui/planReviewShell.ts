import type { QuickAction } from '../participant/actions';
import type { PipelineState } from '../pipeline/stateMachine';

export interface PlanReviewShellPayload {
  requestId: string;
  state: PipelineState;
  summary: string;
  actions: readonly QuickAction[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderPlanReviewShell(payload: PlanReviewShellPayload): string {
  const actions = payload.actions
    .map((action) => `<button data-action="${action}">${action}</button>`)
    .join('');

  return [
    '<section class="plan-review-shell">',
    `  <h1>PlaywrightAgent Plan Review</h1>`,
    `  <p data-request-id="${escapeHtml(payload.requestId)}">Request: ${escapeHtml(payload.requestId)}</p>`,
    `  <p data-state="${escapeHtml(payload.state)}">State: ${escapeHtml(payload.state)}</p>`,
    `  <p data-summary>${escapeHtml(payload.summary)}</p>`,
    `  <div data-actions>${actions}</div>`,
    '</section>'
  ].join('\n');
}

export class PlanReviewShell {
  private payload: PlanReviewShellPayload | undefined;

  open(payload: PlanReviewShellPayload): string {
    this.payload = payload;
    return renderPlanReviewShell(payload);
  }

  getLastPayload(): PlanReviewShellPayload | undefined {
    return this.payload;
  }
}
