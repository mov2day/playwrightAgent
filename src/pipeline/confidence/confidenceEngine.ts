import {
  DEFAULT_CONFIDENCE_PROFILE,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  type ConfidenceDecision,
  type ConfidenceDecisionInput,
  type ConfidenceGate,
  type ConfidenceWeightProfile
} from './confidenceContracts';

function clampRange(value: number, min = 0, max = 100): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function toFinalScore(input: ConfidenceDecisionInput, profile: ConfidenceWeightProfile): number {
  const normalizedScores = {
    repo: clampRange(input.componentScores.repo),
    jira: clampRange(input.componentScores.jira),
    confluence: clampRange(input.componentScores.confluence),
    user_context: clampRange(input.componentScores.user_context)
  };

  const totalWeight = profile.weights.repo
    + profile.weights.jira
    + profile.weights.confluence
    + profile.weights.user_context;

  if (totalWeight <= 0) {
    return 0;
  }

  const weightedSum = (normalizedScores.repo * profile.weights.repo)
    + (normalizedScores.jira * profile.weights.jira)
    + (normalizedScores.confluence * profile.weights.confluence)
    + (normalizedScores.user_context * profile.weights.user_context);

  return clampRange(weightedSum / totalWeight);
}

function toGate(finalScore: number): ConfidenceGate {
  if (finalScore < DEFAULT_CONFIDENCE_THRESHOLDS.rejectBelow) {
    return 'reject';
  }
  if (finalScore <= DEFAULT_CONFIDENCE_THRESHOLDS.approvalMax) {
    return 'approval_required';
  }
  return 'continue';
}

export function computeConfidenceDecision(
  input: ConfidenceDecisionInput,
  profile: ConfidenceWeightProfile = DEFAULT_CONFIDENCE_PROFILE
): ConfidenceDecision {
  const finalScore = toFinalScore(input, profile);
  const gate = toGate(finalScore);

  return {
    profileId: profile.profileId,
    profileVersion: profile.version,
    gate,
    componentScores: {
      repo: clampRange(input.componentScores.repo),
      jira: clampRange(input.componentScores.jira),
      confluence: clampRange(input.componentScores.confluence),
      user_context: clampRange(input.componentScores.user_context)
    },
    finalScore,
    thresholds: DEFAULT_CONFIDENCE_THRESHOLDS
  };
}
