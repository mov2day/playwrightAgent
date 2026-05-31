import type { SpecPlacementMode } from '../generation/specPlacement';

export const WRITER_MODES = ['patch_existing', 'create_scoped', 'skip'] as const;

export type WriterMode = SpecPlacementMode | 'skip';

export type AnchorUnsafeReason =
  | 'unsafe'
  | 'missing_anchor'
  | 'describe_not_found'
  | 'marker_mismatch';

export type WriteOutcomeStatus = 'patched' | 'created' | 'skipped';

export interface WritePlanEntryInput {
  targetPath: string;
  mode: WriterMode;
  scenarioIds: readonly string[];
  generatedBlock: string;
  describeName?: string;
  markerBegin?: string;
  markerEnd?: string;
}

export interface WritePlanEntry {
  targetPath: string;
  mode: WriterMode;
  scenarioIds: string[];
  generatedBlock: string;
  describeName?: string;
  markerBegin?: string;
  markerEnd?: string;
}

export interface WriteOutcome {
  targetPath: string;
  mode: WriterMode;
  status: WriteOutcomeStatus;
  reason?: AnchorUnsafeReason;
  noDelete: boolean;
  preserveExisting: boolean;
}

export function createWritePlanEntry(input: WritePlanEntryInput): WritePlanEntry {
  const scenarioIds = [...new Set(input.scenarioIds.map((scenarioId) => scenarioId.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));

  return {
    targetPath: input.targetPath.trim(),
    mode: input.mode,
    scenarioIds,
    generatedBlock: input.generatedBlock,
    describeName: input.describeName?.trim() || undefined,
    markerBegin: input.markerBegin?.trim() || undefined,
    markerEnd: input.markerEnd?.trim() || undefined
  };
}
