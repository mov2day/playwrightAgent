import { createTwoFilesPatch, structuredPatch } from 'diff';

import { PREVIEW_VERSION, type PreviewChangeType, type PreviewFileDiff } from './previewContracts';

export interface PreviewDiffInput {
  path: string;
  changeType: PreviewChangeType;
  previousContent?: string;
  nextContent?: string;
}

export interface BuildUnifiedFileDiffsOptions {
  previewVersion?: string;
  contextLines?: number;
}

interface DiffLineSummary {
  addedLineCount: number;
  removedLineCount: number;
}

function normalizeContent(value: string | undefined): string {
  return (value ?? '').replace(/\r\n/g, '\n');
}

function countLines(content: string): number {
  if (!content) {
    return 0;
  }

  return content.split('\n').length;
}

function summarizeLines(path: string, previousContent: string, nextContent: string, contextLines: number): DiffLineSummary {
  const parsed = structuredPatch(
    `a/${path}`,
    `b/${path}`,
    previousContent,
    nextContent,
    '',
    '',
    { context: contextLines }
  );

  let addedLineCount = 0;
  let removedLineCount = 0;

  for (const hunk of parsed.hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        addedLineCount += 1;
      } else if (line.startsWith('-')) {
        removedLineCount += 1;
      }
    }
  }

  return {
    addedLineCount,
    removedLineCount
  };
}

export function buildUnifiedFileDiffs(
  inputs: readonly PreviewDiffInput[],
  options: BuildUnifiedFileDiffsOptions = {}
): PreviewFileDiff[] {
  const previewVersion = options.previewVersion ?? PREVIEW_VERSION;
  const contextLines = options.contextLines ?? 3;

  return [...inputs]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((input) => {
      const previousContent = normalizeContent(input.previousContent);
      const nextContent = normalizeContent(input.nextContent);
      const unifiedPatch = createTwoFilesPatch(
        `a/${input.path}`,
        `b/${input.path}`,
        previousContent,
        nextContent,
        '',
        '',
        { context: contextLines }
      );
      const lineSummary = summarizeLines(input.path, previousContent, nextContent, contextLines);

      return {
        path: input.path,
        changeType: input.changeType,
        beforeLineCount: countLines(previousContent),
        afterLineCount: countLines(nextContent),
        addedLineCount: lineSummary.addedLineCount,
        removedLineCount: lineSummary.removedLineCount,
        unifiedPatch,
        previewVersion
      };
    });
}
