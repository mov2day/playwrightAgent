import type {
  ConfidenceDecision,
  ConfidenceDecisionInput,
  ConfidenceEvidenceRef
} from './confidenceContracts';

export interface ConfidenceThresholdComparison {
  rule: string;
  matched: boolean;
}

export interface ConfidenceExplainability {
  profileId: string;
  profileVersion: string;
  gate: ConfidenceDecision['gate'];
  finalScore: number;
  componentScores: ConfidenceDecision['componentScores'];
  thresholdComparisons: ConfidenceThresholdComparison[];
  evidence: ConfidenceEvidenceRef[];
  reasons: string[];
}

const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|apikey|api_key)/i;

function sanitizeSnippet(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }

  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret)\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]')
    .slice(0, 280);
}

function sanitizeMetadata(metadata: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      continue;
    }
    sanitized[key] = sanitizeSnippet(value) ?? '';
  }
  return sanitized;
}

function sanitizeEvidenceReference(reference: ConfidenceEvidenceRef): ConfidenceEvidenceRef {
  return {
    source: reference.source,
    issueKey: reference.issueKey,
    pageId: reference.pageId,
    findingId: reference.findingId,
    snippet: sanitizeSnippet(reference.snippet),
    metadata: sanitizeMetadata(reference.metadata)
  };
}

export function buildConfidenceExplainability(
  decision: ConfidenceDecision,
  input: ConfidenceDecisionInput
): ConfidenceExplainability {
  return {
    profileId: decision.profileId,
    profileVersion: decision.profileVersion,
    gate: decision.gate,
    finalScore: decision.finalScore,
    componentScores: decision.componentScores,
    thresholdComparisons: [
      {
        rule: '<40 reject',
        matched: decision.finalScore < decision.thresholds.rejectBelow
      },
      {
        rule: '40-70 approval',
        matched: decision.finalScore >= decision.thresholds.approvalMin
          && decision.finalScore <= decision.thresholds.approvalMax
      },
      {
        rule: '>70 continue',
        matched: decision.finalScore > decision.thresholds.continueAbove
      }
    ],
    evidence: (input.evidence ?? []).map(sanitizeEvidenceReference),
    reasons: input.reasons ?? []
  };
}
