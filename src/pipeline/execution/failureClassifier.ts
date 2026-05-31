export type ExecutionFailureBucket =
  | 'test_authoring'
  | 'application_behavior'
  | 'environment_or_tooling';

export interface ExecutionFailureInput {
  targetPath: string;
  message: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  timedOut?: boolean;
}

export interface ExecutionFailureClassification {
  targetPath: string;
  message: string;
  bucket: ExecutionFailureBucket;
  bucketReason: string;
  evidence: string[];
}

interface BucketMatch {
  bucket: ExecutionFailureBucket;
  bucketReason: string;
}

interface ClassifierPattern {
  pattern: RegExp;
  bucketReason: string;
}

const ENVIRONMENT_PATTERNS: readonly ClassifierPattern[] = [
  {
    pattern: /\b(econnrefused|enoent|eacces|command not found|cannot find module)\b/i,
    bucketReason: 'Environment or tooling dependency unavailable.'
  },
  {
    pattern: /\b(npm err|playwright install|failed to launch|browser has been closed)\b/i,
    bucketReason: 'Tooling runtime failed before scenario assertions completed.'
  }
];

const APPLICATION_PATTERNS: readonly ClassifierPattern[] = [
  {
    pattern: /\b(received\s+5\d\d|status(?:\s*code)?\s*[45]\d\d|internal server error)\b/i,
    bucketReason: 'Application/service behavior diverged from expected response.'
  },
  {
    pattern: /\b(service unavailable|gateway timeout|response .* failed)\b/i,
    bucketReason: 'Application dependency returned unstable runtime behavior.'
  }
];

const TEST_AUTHORING_PATTERNS: readonly ClassifierPattern[] = [
  {
    pattern: /\b(locator|selector|strict mode violation)\b/i,
    bucketReason: 'locator or selector mismatch indicates test authoring issue.'
  },
  {
    pattern: /\b(expect\(|tohave|tobevisible|tobehidden|cannot read properties of undefined)\b/i,
    bucketReason: 'Assertion wiring indicates likely test authoring issue.'
  }
];

function collectEvidence(input: ExecutionFailureInput): string[] {
  return [
    input.message,
    input.stderr ?? '',
    input.stdout ?? ''
  ]
    .map((value) => value.trim())
    .filter(Boolean);
}

function findPatternMatch(
  evidenceText: string,
  patterns: readonly ClassifierPattern[],
  bucket: ExecutionFailureBucket
): BucketMatch | undefined {
  for (const candidate of patterns) {
    if (candidate.pattern.test(evidenceText)) {
      return {
        bucket,
        bucketReason: candidate.bucketReason
      };
    }
  }

  return undefined;
}

export function classifyExecutionFailure(
  input: ExecutionFailureInput
): ExecutionFailureClassification {
  const evidence = collectEvidence(input);
  const evidenceText = evidence.join('\n');

  if (input.timedOut) {
    return {
      targetPath: input.targetPath,
      message: input.message,
      bucket: 'environment_or_tooling',
      bucketReason: 'Command timed out before deterministic scenario completion.',
      evidence
    };
  }

  const environmentMatch = findPatternMatch(
    evidenceText,
    ENVIRONMENT_PATTERNS,
    'environment_or_tooling'
  );
  if (environmentMatch) {
    return {
      targetPath: input.targetPath,
      message: input.message,
      bucket: environmentMatch.bucket,
      bucketReason: environmentMatch.bucketReason,
      evidence
    };
  }

  const applicationMatch = findPatternMatch(
    evidenceText,
    APPLICATION_PATTERNS,
    'application_behavior'
  );
  if (applicationMatch) {
    return {
      targetPath: input.targetPath,
      message: input.message,
      bucket: applicationMatch.bucket,
      bucketReason: applicationMatch.bucketReason,
      evidence
    };
  }

  const authoringMatch = findPatternMatch(
    evidenceText,
    TEST_AUTHORING_PATTERNS,
    'test_authoring'
  );
  if (authoringMatch) {
    return {
      targetPath: input.targetPath,
      message: input.message,
      bucket: authoringMatch.bucket,
      bucketReason: authoringMatch.bucketReason,
      evidence
    };
  }

  return {
    targetPath: input.targetPath,
    message: input.message,
    bucket: 'application_behavior',
    bucketReason: 'Defaulted to application behavior due absence of authoring/tooling signatures.',
    evidence
  };
}

export function classifyExecutionFailures(
  failures: readonly ExecutionFailureInput[]
): ExecutionFailureClassification[] {
  return failures.map((failure) => classifyExecutionFailure(failure));
}
