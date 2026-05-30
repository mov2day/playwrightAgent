import type {
  AnalyzerFinding,
  PatternClassification,
  RepoAnalysisSummary,
  ReuseCandidate
} from './contracts';

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export interface BuildRepoAnalysisSummaryInput {
  frameworkResult: string;
  pattern: PatternClassification;
  reuseCandidates: ReuseCandidate[];
  findings: AnalyzerFinding[];
  confidencePenalty?: number;
  warnings?: string[];
}

export function buildRepoAnalysisSummary(input: BuildRepoAnalysisSummaryInput): RepoAnalysisSummary {
  const warnings = [...(input.warnings ?? [])];
  const confidencePenalty = input.confidencePenalty ?? 0;

  const averageConfidence = input.findings.length > 0
    ? input.findings.reduce((total, finding) => total + finding.confidence, 0) / input.findings.length
    : 0;

  const overallConfidence = clamp01(averageConfidence - confidencePenalty);

  if (overallConfidence < 0.5) {
    warnings.push('Repo analyzer confidence is low; conservative defaults recommended.');
  }

  return {
    framework: input.frameworkResult,
    pattern: input.pattern,
    reuseCandidates: input.reuseCandidates,
    overallConfidence,
    warnings,
    confidencePenalty
  };
}
