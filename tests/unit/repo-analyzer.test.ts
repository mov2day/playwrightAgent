import { describe, expect, it } from 'vitest';

import type { AnalyzerFinding, PatternClassification } from '../../src/pipeline/repoAnalysis/contracts';
import { buildRepoAnalysisSummary } from '../../src/pipeline/repoAnalysis/summary';

describe('buildRepoAnalysisSummary', () => {
  it('builds an overall summary from findings', () => {
    const findings: AnalyzerFinding[] = [
      {
        id: 'framework-1',
        category: 'framework',
        result: 'typescript-playwright',
        confidence: 0.9,
        evidence: [{ source: 'package.json', ref: 'devDependencies.playwright' }]
      }
    ];

    const pattern: PatternClassification = {
      primaryPattern: 'pom',
      secondaryPatterns: [],
      confidenceByPattern: {
        pom: 0.8,
        screenplay: 0.1,
        hybrid: 0.1,
        unknown: 0
      },
      tieBreakUsed: false
    };

    const summary = buildRepoAnalysisSummary({
      frameworkResult: 'typescript-playwright',
      pattern,
      reuseCandidates: [],
      findings,
      confidencePenalty: 0
    });

    expect(summary.framework).toBe('typescript-playwright');
    expect(summary.pattern.primaryPattern).toBe('pom');
    expect(summary.overallConfidence).toBeGreaterThan(0.8);
  });
});
