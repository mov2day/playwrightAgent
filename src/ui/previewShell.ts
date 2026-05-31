import type { PipelineState } from '../pipeline/stateMachine';
import { sanitizeReviewText } from './reviewModel';
import { type PreviewViewModel, sanitizePreviewModel } from './previewModel';
import { renderPreviewPanelMarkup } from './reviewApp';

export interface PreviewShellPayload {
  requestId: string;
  state: PipelineState;
  chatSummary: string;
  previewModel: PreviewViewModel;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizePayload(payload: PreviewShellPayload): PreviewShellPayload {
  return {
    requestId: sanitizeReviewText(payload.requestId),
    state: payload.state,
    chatSummary: sanitizeReviewText(payload.chatSummary),
    previewModel: sanitizePreviewModel(payload.previewModel)
  };
}

export function renderPreviewShell(payload: PreviewShellPayload): string {
  const sanitizedPayload = sanitizePayload(payload);
  const panelMarkup = renderPreviewPanelMarkup(sanitizedPayload.previewModel);
  const serializedModel = escapeHtml(JSON.stringify(sanitizedPayload.previewModel));

  return [
    '<section class="preview-shell">',
    '  <h1>PlaywrightAgent Script Preview</h1>',
    `  <p data-request-id="${escapeHtml(sanitizedPayload.requestId)}">Request: ${escapeHtml(sanitizedPayload.requestId)}</p>`,
    `  <p data-state="${escapeHtml(sanitizedPayload.state)}">State: ${escapeHtml(sanitizedPayload.state)}</p>`,
    `  <p data-chat-summary>${escapeHtml(sanitizedPayload.chatSummary)}</p>`,
    '  <button type="button" data-action="approve">Approve All Changes</button>',
    '  <div id="preview-root" data-react-root>',
    panelMarkup,
    '  </div>',
    `  <script id="preview-model" type="application/json">${serializedModel}</script>`,
    '</section>'
  ].join('\n');
}

export class PreviewShell {
  private payload: PreviewShellPayload | undefined;

  open(payload: PreviewShellPayload): string {
    this.payload = sanitizePayload(payload);
    return renderPreviewShell(this.payload);
  }

  getLastPayload(): PreviewShellPayload | undefined {
    return this.payload;
  }
}
