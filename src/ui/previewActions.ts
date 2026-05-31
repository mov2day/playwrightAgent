export type PreviewActionSource = 'chat' | 'webview' | 'system';

interface PreviewActionBase {
  requestId: string;
  source: PreviewActionSource;
  optimisticVersion: number;
}

export interface PreviewApproveAllAction extends PreviewActionBase {
  type: 'preview.approve_all';
  previewVersion: string;
}

export type PreviewActionEnvelope = PreviewApproveAllAction;

const PREVIEW_ACTION_TYPES = new Set<string>(['preview.approve_all']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isPreviewActionEnvelope(value: unknown): value is PreviewActionEnvelope {
  if (!isObject(value)) {
    return false;
  }

  if (!hasString(value.type) || !PREVIEW_ACTION_TYPES.has(value.type)) {
    return false;
  }

  if (!hasString(value.requestId) || !hasString(value.source) || !hasNumber(value.optimisticVersion)) {
    return false;
  }

  if (value.type === 'preview.approve_all' && !hasString(value.previewVersion)) {
    return false;
  }

  return true;
}

export function createPreviewApproveAllAction(
  requestId: string,
  optimisticVersion: number,
  source: PreviewActionSource = 'webview',
  previewVersion: string
): PreviewApproveAllAction {
  return {
    type: 'preview.approve_all',
    requestId,
    source,
    optimisticVersion,
    previewVersion
  };
}
