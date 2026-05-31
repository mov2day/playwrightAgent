import type { AnchorUnsafeReason, WriteOutcome } from './writeContracts';

export interface WriteReportSummary {
  total: number;
  patched: number;
  created: number;
  skipped: number;
}

export interface WriteReport {
  requestId: string;
  previewVersion: string;
  summary: WriteReportSummary;
  outcomes: WriteOutcome[];
  skippedReasons: Partial<Record<AnchorUnsafeReason, number>>;
}

function summarizeOutcomes(outcomes: readonly WriteOutcome[]): WriteReportSummary {
  return outcomes.reduce<WriteReportSummary>((summary, outcome) => {
    summary.total += 1;

    if (outcome.status === 'patched') {
      summary.patched += 1;
    } else if (outcome.status === 'created') {
      summary.created += 1;
    } else if (outcome.status === 'skipped') {
      summary.skipped += 1;
    }

    return summary;
  }, {
    total: 0,
    patched: 0,
    created: 0,
    skipped: 0
  });
}

function summarizeSkippedReasons(outcomes: readonly WriteOutcome[]): Partial<Record<AnchorUnsafeReason, number>> {
  return outcomes.reduce<Partial<Record<AnchorUnsafeReason, number>>>((summary, outcome) => {
    if (outcome.status !== 'skipped' || !outcome.reason) {
      return summary;
    }

    summary[outcome.reason] = (summary[outcome.reason] ?? 0) + 1;
    return summary;
  }, {});
}

export function buildWriteReportSummary(
  requestId: string,
  previewVersion: string,
  outcomes: readonly WriteOutcome[]
): WriteReport {
  return {
    requestId,
    previewVersion,
    summary: summarizeOutcomes(outcomes),
    outcomes: outcomes.map((outcome) => ({ ...outcome })),
    skippedReasons: summarizeSkippedReasons(outcomes)
  };
}
