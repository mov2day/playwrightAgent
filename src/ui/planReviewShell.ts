import type { QuickAction } from '../participant/actions';
import { buildPlanReviewBundle } from '../pipeline/planning/scenarioGrouping';
import { buildScenarioPlan } from '../pipeline/planning/scenarioMapper';
import type { PipelineState } from '../pipeline/stateMachine';
import { buildReviewViewModel, type ReviewViewModel } from './reviewModel';
import { renderReviewAppToHtml } from './reviewApp';

export interface PlanReviewShellPayload {
  requestId: string;
  state: PipelineState;
  summary: string;
  actions: readonly QuickAction[];
  reviewModel?: ReviewViewModel;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildFallbackReviewModel(payload: PlanReviewShellPayload): ReviewViewModel {
  const scenarioRecords = buildScenarioPlan([
    {
      requirementId: 'PLAN-03',
      acceptanceCriteriaIds: ['AC-1'],
      scenarioName: 'Scenario review summary',
      scope: 'Plan review',
      assertionIntentSummary: payload.summary,
      functionality: 'Planning',
      riskLevel: 'medium',
      riskReason: 'Summary-only payload requires manual confirmation.',
      sourceEvidenceIds: [payload.requestId]
    }
  ]);

  const bundle = buildPlanReviewBundle(scenarioRecords);

  return buildReviewViewModel({
    requestId: payload.requestId,
    state: payload.state,
    bundle,
    availableActions: payload.actions
  });
}

export function renderPlanReviewShell(payload: PlanReviewShellPayload): string {
  const reviewModel = payload.reviewModel ?? buildFallbackReviewModel(payload);
  const appMarkup = renderReviewAppToHtml(reviewModel);
  const serializedModel = escapeHtml(JSON.stringify(reviewModel));

  return [
    '<section class="plan-review-shell">',
    '  <h1>PlaywrightAgent Plan Review</h1>',
    `  <p data-request-id="${escapeHtml(payload.requestId)}">Request: ${escapeHtml(payload.requestId)}</p>`,
    `  <p data-state="${escapeHtml(payload.state)}">State: ${escapeHtml(payload.state)}</p>`,
    `  <p data-summary>${escapeHtml(payload.summary)}</p>`,
    '  <div id="plan-review-root" data-react-root>',
    appMarkup,
    '  </div>',
    `  <script id="plan-review-model" type="application/json">${serializedModel}</script>`,
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
