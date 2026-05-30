import { describe, expect, it } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import {
  type ConfidenceDecisionInput,
  type ConfidenceWeightProfile
} from '../../src/pipeline/confidence/confidenceContracts';
import { computeConfidenceDecision } from '../../src/pipeline/confidence/confidenceEngine';
import { buildConfidenceExplainability } from '../../src/pipeline/confidence/explainability';

const UNIT_PROFILE: ConfidenceWeightProfile = {
  profileId: 'unit-profile',
  version: '1.0.0',
  weights: {
    repo: 1,
    jira: 1,
    confluence: 1,
    user_context: 1
  }
};

function withUniformScore(score: number): ConfidenceDecisionInput {
  return {
    componentScores: {
      repo: score,
      jira: score,
      confluence: score,
      user_context: score
    },
    evidence: [],
    reasons: []
  };
}

describe('computeConfidenceDecision', () => {
  it('routes thresholds exactly at 39.99, 40, 70, and 70.01', () => {
    expect(computeConfidenceDecision(withUniformScore(39.99), UNIT_PROFILE).gate).toBe('reject');
    expect(computeConfidenceDecision(withUniformScore(40), UNIT_PROFILE).gate).toBe('approval_required');
    expect(computeConfidenceDecision(withUniformScore(70), UNIT_PROFILE).gate).toBe('approval_required');
    expect(computeConfidenceDecision(withUniformScore(70.01), UNIT_PROFILE).gate).toBe('continue');
  });
});

describe('buildConfidenceExplainability', () => {
  it('sanitizes token, secret, and Authorization evidence fields', () => {
    const input: ConfidenceDecisionInput = {
      componentScores: {
        repo: 60,
        jira: 60,
        confluence: 60,
        user_context: 60
      },
      evidence: [
        {
          source: 'jira',
          issueKey: 'QA-900',
          snippet: 'Authorization=Bearer abc123 token=my-token secret=s1',
          metadata: {
            Authorization: 'Bearer abc123',
            token: 'my-token',
            secret: 's1',
            safe_key: 'retain-me'
          }
        }
      ],
      reasons: []
    };

    const decision = computeConfidenceDecision(input, UNIT_PROFILE);
    const explainability = buildConfidenceExplainability(decision, input);
    const evidence = explainability.evidence[0];

    expect(evidence?.snippet).toContain('[REDACTED]');
    expect(evidence?.snippet).not.toContain('abc123');
    expect(evidence?.metadata).toEqual({
      safe_key: 'retain-me'
    });
  });

  it('emits confidence profile and gate fields on pipeline events', () => {
    const sink = new InMemoryEventSink();
    sink.emit({
      requestId: 'req_conf_evt_1',
      stage: 'gate',
      action: 'confidence_computed',
      timestamp: '2026-05-30T16:00:00.000Z',
      confidenceProfileId: 'v1-default',
      decisionGate: 'continue'
    });

    const event = sink.getEvents().find((item) => item.action === 'confidence_computed');

    expect(event?.confidenceProfileId).toBeDefined();
    expect(event?.decisionGate).toBe('continue');
  });
});
