import type { PreviewBundle, PreviewFileDiff, PreviewSummary } from '../pipeline/preview/previewContracts';
import { sanitizeReviewText } from './reviewModel';

const SCRIPT_BLOCK_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const HTML_TAG_PATTERN = /<[^>]+>/g;
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9._~-]+/gi;

export interface PreviewFileDiffView extends PreviewFileDiff {
  unifiedPatch: string;
}

export interface PreviewViewModel {
  requestId: string;
  previewVersion: string;
  chatSummary: string;
  previewSummary: PreviewSummary;
  fileDiffs: PreviewFileDiffView[];
}

function sanitizePatchText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(SCRIPT_BLOCK_PATTERN, '[SCRIPT_REDACTED]')
    .replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]')
    .replace(HTML_TAG_PATTERN, '');
}

function sanitizeFileDiff(fileDiff: PreviewFileDiff): PreviewFileDiffView {
  return {
    ...fileDiff,
    path: sanitizeReviewText(fileDiff.path),
    unifiedPatch: sanitizePatchText(fileDiff.unifiedPatch)
  };
}

function cloneSummary(summary: PreviewSummary): PreviewSummary {
  return {
    totalFiles: summary.totalFiles,
    addedFiles: summary.addedFiles,
    modifiedFiles: summary.modifiedFiles,
    deletedFiles: summary.deletedFiles,
    totalAddedLines: summary.totalAddedLines,
    totalRemovedLines: summary.totalRemovedLines
  };
}

export function buildPreviewModel(bundle: PreviewBundle): PreviewViewModel {
  return {
    requestId: sanitizeReviewText(bundle.requestId),
    previewVersion: sanitizeReviewText(bundle.previewVersion),
    chatSummary: sanitizeReviewText(bundle.chatSummary),
    previewSummary: cloneSummary(bundle.summary),
    fileDiffs: bundle.fileDiffs.map(sanitizeFileDiff)
  };
}

export function sanitizePreviewModel(model: PreviewViewModel): PreviewViewModel {
  return {
    requestId: sanitizeReviewText(model.requestId),
    previewVersion: sanitizeReviewText(model.previewVersion),
    chatSummary: sanitizeReviewText(model.chatSummary),
    previewSummary: cloneSummary(model.previewSummary),
    fileDiffs: model.fileDiffs.map(sanitizeFileDiff)
  };
}
