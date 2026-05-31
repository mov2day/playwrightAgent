import type { LocalToolCommandResult } from '../../adapters/localToolRunner';
import {
  classifyExecutionFailures,
  type ExecutionFailureBucket,
  type ExecutionFailureClassification,
  type ExecutionFailureInput
} from './failureClassifier';

export interface ExecutionRunSummaryInput {
  requestId: string;
  commandResult: LocalToolCommandResult;
  passCount: number;
  failCount: number;
  failures: readonly ExecutionFailureInput[];
}

export interface ExecutionRunSummary {
  passCount: number;
  failCount: number;
  failingFiles: string[];
  topErrors: string[];
  bucketCounts: Record<ExecutionFailureBucket, number>;
}

export interface ExecutionRunExpandableDetails {
  expandable: true;
  rawStdout: string;
  rawStderr: string;
  failures: Array<{
    targetPath: string;
    message: string;
    bucket: ExecutionFailureBucket;
    bucketReason: string;
    evidence: string[];
  }>;
}

export interface ExecutionRunSummaryReport {
  requestId: string;
  summary: ExecutionRunSummary;
  expandable: ExecutionRunExpandableDetails;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function summarizeTopErrors(
  classifications: readonly ExecutionFailureClassification[]
): string[] {
  const counts = new Map<string, number>();
  for (const classification of classifications) {
    const firstLine = classification.message.split('\n')[0]?.trim() ?? '';
    if (!firstLine) {
      continue;
    }
    counts.set(firstLine, (counts.get(firstLine) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 5)
    .map(([message]) => message);
}

function summarizeBucketCounts(
  classifications: readonly ExecutionFailureClassification[]
): Record<ExecutionFailureBucket, number> {
  const bucketCounts: Record<ExecutionFailureBucket, number> = {
    test_authoring: 0,
    application_behavior: 0,
    environment_or_tooling: 0
  };

  for (const classification of classifications) {
    bucketCounts[classification.bucket] += 1;
  }

  return bucketCounts;
}

export function buildExecutionRunSummary(
  input: ExecutionRunSummaryInput
): ExecutionRunSummaryReport {
  const classifications = classifyExecutionFailures(input.failures);
  const failingFiles = uniqueSorted(classifications.map((classification) => classification.targetPath));
  const topErrors = summarizeTopErrors(classifications);

  return {
    requestId: input.requestId,
    summary: {
      passCount: input.passCount,
      failCount: input.failCount,
      failingFiles,
      topErrors,
      bucketCounts: summarizeBucketCounts(classifications)
    },
    expandable: {
      expandable: true,
      rawStdout: input.commandResult.stdout,
      rawStderr: input.commandResult.stderr,
      failures: classifications.map((classification) => ({
        targetPath: classification.targetPath,
        message: classification.message,
        bucket: classification.bucket,
        bucketReason: classification.bucketReason,
        evidence: [...classification.evidence]
      }))
    }
  };
}
