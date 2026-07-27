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
  const script = `
  <script>
    (function () {
      const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
      if (!vscode) {
        return;
      }

      const root = document.getElementById('plan-review-root');
      if (!root) {
        return;
      }

      const requestId = root.getAttribute('data-request-id');
      if (!requestId) {
        return;
      }

      const postQuickAction = (action) => {
        vscode.postMessage({
          kind: 'quickAction',
          requestId,
          action
        });
      };

      const inferClassification = (text) => {
        const normalized = String(text || '').trim();
        if (/\\b(must|constraint|limit|cannot|should not)\\b/i.test(normalized)) {
          return 'constraint';
        }
        if (/\\b(bug|fail(?:ing|ed)?|error|broken|flaky)\\b/i.test(normalized)) {
          return 'bug';
        }
        if (/\\b(new|add|also|include|another)\\b/i.test(normalized)) {
          return 'new_context';
        }
        return 'clarification';
      };

      root.addEventListener('click', function (event) {
        const target = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
        if (!target) {
          return;
        }

        event.preventDefault();
        const action = target.getAttribute('data-action');
        if (!action) {
          return;
        }

          const optimisticVersion = Date.now();
          const scenarioId = target.getAttribute('data-scenario-id') || undefined;
          const mode = target.getAttribute('data-mode') || undefined;
          const reason = target.getAttribute('data-reason') || undefined;
          const commentTarget = target.getAttribute('data-target') || undefined;

          if (action === 'quick.approve') {
            postQuickAction('approve');
            return;
          }
          if (action === 'quick.reject') {
            postQuickAction('reject');
            return;
          }
          if (action === 'quick.continue') {
            postQuickAction('continue');
            return;
          }
          if (action === 'quick.cancel') {
            postQuickAction('cancel');
            return;
          }

          if (action === 'scenario.approve' && scenarioId) {
            vscode.postMessage({
              type: 'scenario.approve',
              requestId,
              source: 'webview',
              optimisticVersion,
              scenarioId
            });
            return;
          }

          if (action === 'scenario.reject' && scenarioId) {
            vscode.postMessage({
              type: 'scenario.reject',
              requestId,
              source: 'webview',
              optimisticVersion,
              scenarioId,
              reason
            });
            return;
          }

          if (action === 'scenario.revise' && scenarioId && reason) {
            vscode.postMessage({
              type: 'scenario.revise',
              requestId,
              source: 'webview',
              optimisticVersion,
              scenarioId,
              reason
            });
            return;
          }

          if (action === 'bulk.approve' && mode) {
            vscode.postMessage({
              type: 'bulk.approve',
              requestId,
              source: 'webview',
              optimisticVersion,
              mode
            });
            return;
          }

          if ((action === 'bulk.reject' || action === 'bulk.force_reject') && mode) {
            vscode.postMessage({
              type: 'bulk.reject',
              requestId,
              source: 'webview',
              optimisticVersion,
              mode,
              reason
            });
            return;
          }

          if (action === 'bulk.force_approve') {
            vscode.postMessage({
              type: 'bulk.approve',
              requestId,
              source: 'webview',
              optimisticVersion,
              mode: 'force_override'
            });
            return;
          }

          if (action === 'comment.add' && commentTarget) {
            let input;
            if (commentTarget === 'scenario' && scenarioId) {
              input = root.querySelector('[data-comment-input="scenario"][data-scenario-id="' + scenarioId + '"]');
            } else if (commentTarget === 'global') {
              input = root.querySelector('[data-comment-input="global"]');
            }

            const text = input && 'value' in input ? String(input.value || '').trim() : '';
            if (!text) {
              return;
            }

            vscode.postMessage({
              type: 'comment.add',
              requestId,
              source: 'webview',
              optimisticVersion,
              target: commentTarget,
              scenarioId,
              classification: inferClassification(text),
              text
            });

            if (input && 'value' in input) {
              input.value = '';
            }
          }
      });
    }());
  </script>`;

  return [
    '<section class="plan-review-shell">',
    '  <h1>PlaywrightAgent Plan Review</h1>',
    `  <p data-request-id="${escapeHtml(payload.requestId)}">Request: ${escapeHtml(payload.requestId)}</p>`,
    `  <p data-state="${escapeHtml(payload.state)}">State: ${escapeHtml(payload.state)}</p>`,
    `  <p data-summary>${escapeHtml(payload.summary)}</p>`,
    `  <div id="plan-review-root" data-react-root data-request-id="${escapeHtml(payload.requestId)}">`,
    appMarkup,
    '  </div>',
    `  <script id="plan-review-model" type="application/json">${serializedModel}</script>`,
    script,
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
