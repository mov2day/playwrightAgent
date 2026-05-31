import { z } from 'zod';

export const PREVIEW_VERSION = 'preview.v1';

export type PreviewChangeType = 'added' | 'modified' | 'deleted';

export interface PreviewSummary {
  totalFiles: number;
  addedFiles: number;
  modifiedFiles: number;
  deletedFiles: number;
  totalAddedLines: number;
  totalRemovedLines: number;
}

export interface PreviewFileDiff {
  path: string;
  changeType: PreviewChangeType;
  beforeLineCount: number;
  afterLineCount: number;
  addedLineCount: number;
  removedLineCount: number;
  unifiedPatch: string;
  previewVersion: string;
}

export interface PreviewBundle {
  requestId: string;
  previewVersion: string;
  chatSummary: string;
  summary: PreviewSummary;
  fileDiffs: PreviewFileDiff[];
}

const previewSummarySchema = z.object({
  totalFiles: z.number().int().min(0),
  addedFiles: z.number().int().min(0),
  modifiedFiles: z.number().int().min(0),
  deletedFiles: z.number().int().min(0),
  totalAddedLines: z.number().int().min(0),
  totalRemovedLines: z.number().int().min(0)
});

const previewFileDiffSchema = z.object({
  path: z.string().min(1),
  changeType: z.union([z.literal('added'), z.literal('modified'), z.literal('deleted')]),
  beforeLineCount: z.number().int().min(0),
  afterLineCount: z.number().int().min(0),
  addedLineCount: z.number().int().min(0),
  removedLineCount: z.number().int().min(0),
  unifiedPatch: z.string().min(1),
  previewVersion: z.string().min(1)
});

export const previewBundleSchema = z.object({
  requestId: z.string().min(1),
  previewVersion: z.string().min(1),
  chatSummary: z.string().min(1),
  summary: previewSummarySchema,
  fileDiffs: z.array(previewFileDiffSchema).min(1)
});

export function assertPreviewBundle(value: unknown): asserts value is PreviewBundle {
  previewBundleSchema.parse(value);
}

export interface CreatePreviewBundleInput {
  requestId: string;
  previewVersion?: string;
  chatSummary: string;
  summary: PreviewSummary;
  fileDiffs: PreviewFileDiff[];
}

export function createPreviewBundle(input: CreatePreviewBundleInput): PreviewBundle {
  const bundle: PreviewBundle = {
    requestId: input.requestId,
    previewVersion: input.previewVersion ?? PREVIEW_VERSION,
    chatSummary: input.chatSummary,
    summary: input.summary,
    fileDiffs: input.fileDiffs
  };

  assertPreviewBundle(bundle);
  return bundle;
}
