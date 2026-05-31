import { buildUnifiedFileDiffs, type PreviewDiffInput } from './diffBuilder';
import { PREVIEW_VERSION, createPreviewBundle, type PreviewBundle, type PreviewSummary } from './previewContracts';
import { buildPreviewModel, type PreviewViewModel } from '../../ui/previewModel';

export interface AssemblePreviewBundleInput {
  requestId: string;
  files: readonly PreviewDiffInput[];
  previewVersion?: string;
}

export interface AssembledPreviewBundle {
  requestId: string;
  chatSummary: string;
  previewBundle: PreviewBundle;
  webview: {
    previewModel: PreviewViewModel;
  };
}

function buildPreviewSummary(fileDiffs: PreviewBundle['fileDiffs']): PreviewSummary {
  return fileDiffs.reduce<PreviewSummary>(
    (summary, fileDiff) => {
      if (fileDiff.changeType === 'added') {
        summary.addedFiles += 1;
      } else if (fileDiff.changeType === 'modified') {
        summary.modifiedFiles += 1;
      } else {
        summary.deletedFiles += 1;
      }

      summary.totalAddedLines += fileDiff.addedLineCount;
      summary.totalRemovedLines += fileDiff.removedLineCount;
      summary.totalFiles += 1;
      return summary;
    },
    {
      totalFiles: 0,
      addedFiles: 0,
      modifiedFiles: 0,
      deletedFiles: 0,
      totalAddedLines: 0,
      totalRemovedLines: 0
    }
  );
}

function formatChatSummary(summary: PreviewSummary): string {
  return [
    `Files: ${summary.totalFiles}`,
    `Added: ${summary.addedFiles}`,
    `Modified: ${summary.modifiedFiles}`,
    `Deleted: ${summary.deletedFiles}`,
    `Line delta: +${summary.totalAddedLines}/-${summary.totalRemovedLines}`
  ].join(' | ');
}

export function assemblePreviewBundle(input: AssemblePreviewBundleInput): AssembledPreviewBundle {
  const previewVersion = input.previewVersion ?? PREVIEW_VERSION;
  const fileDiffs = buildUnifiedFileDiffs(input.files, { previewVersion });
  const summary = buildPreviewSummary(fileDiffs);
  const chatSummary = formatChatSummary(summary);
  const previewBundle = createPreviewBundle({
    requestId: input.requestId,
    previewVersion,
    chatSummary,
    summary,
    fileDiffs
  });

  return {
    requestId: input.requestId,
    chatSummary,
    previewBundle,
    webview: {
      previewModel: buildPreviewModel(previewBundle)
    }
  };
}
