import { describe, expect, it } from 'vitest';

import { analyzeRepositoryContext } from '../../src/pipeline/repoAnalysis/repoAnalyzer';
import type { RepoScanSnapshot } from '../../src/pipeline/repoAnalysis/contracts';
import { detectFrameworkFinding } from '../../src/pipeline/repoAnalysis/detectors/frameworkDetector';

function createSnapshot(partial: Partial<RepoScanSnapshot>): RepoScanSnapshot {
  return {
    files: partial.files ?? [],
    fileContents: partial.fileContents ?? {},
    packageJson: partial.packageJson
  };
}

describe('repo analyzer', () => {
  it('detects hybrid pattern signals and returns multi-label summary', () => {
    const snapshot = createSnapshot({
      files: ['src/pages/login.page.ts', 'src/screenplay/tasks/loginTask.ts'],
      fileContents: {
        'src/pages/login.page.ts': 'export class LoginPage {}',
        'src/screenplay/tasks/loginTask.ts': 'export class LoginTask { performAs() {} }\nactor.attemptsTo(loginTask);'
      },
      packageJson: {
        devDependencies: {
          playwright: '^1.57.0',
          vitest: '^2.1.9',
          typescript: '^5.8.3'
        }
      }
    });

    const result = analyzeRepositoryContext({ snapshot });

    expect(result.summary.pattern.primaryPattern).toBe('hybrid');
    expect(result.summary.pattern.secondaryPatterns.length).toBeGreaterThan(0);
    expect(result.summary.pattern.confidenceByPattern.pom).toBeGreaterThan(0);
    expect(result.summary.pattern.confidenceByPattern.screenplay).toBeGreaterThan(0);
  });

  it('applies unknown fallback when detector confidence is below threshold', () => {
    const snapshot = createSnapshot({
      files: ['README.md'],
      fileContents: {
        'README.md': '# Empty signal repository'
      }
    });

    const result = analyzeRepositoryContext({
      snapshot,
      unknownThreshold: 0.9
    });

    expect(result.findings.some((finding) => finding.result === 'unknown')).toBe(true);
    expect(result.summary.confidencePenalty).toBeGreaterThan(0);
    expect(result.summary.warnings.some((warning) => warning.includes('Conservative fallback'))).toBe(true);
  });

  it('summary includes reusable assets list and warnings when weak context exists', () => {
    const snapshot = createSnapshot({
      files: ['src/helpers/authHelper.ts', 'src/misc/plain.txt'],
      fileContents: {
        'src/helpers/authHelper.ts': 'export function authenticate() { return true; }',
        'src/misc/plain.txt': 'not a source file'
      },
      packageJson: {
        dependencies: {
          playwright: '^1.57.0'
        }
      }
    });

    const result = analyzeRepositoryContext({ snapshot });

    expect(result.summary.reuseCandidates.length).toBeGreaterThan(0);
    expect(result.summary.reuseCandidates[0]?.name).toContain('authHelper');
    expect(Array.isArray(result.summary.warnings)).toBe(true);
  });

  it('framework detector emits framework category finding', () => {
    const finding = detectFrameworkFinding(
      createSnapshot({
        files: ['src/index.ts'],
        fileContents: { 'src/index.ts': 'console.log("hi")' },
        packageJson: { dependencies: { playwright: '^1.57.0' } }
      })
    );

    expect(finding.category).toBe('framework');
  });
});
