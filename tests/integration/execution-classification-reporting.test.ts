import { describe, expect, it } from 'vitest';

import type { LocalToolCommandResult } from '../../src/adapters/localToolRunner';
import { classifyExecutionFailures } from '../../src/pipeline/execution/failureClassifier';
import { buildExecutionRunSummary } from '../../src/pipeline/execution/reportSummarizer';

function makeCommandResult(overrides: Partial<LocalToolCommandResult> = {}): LocalToolCommandResult {
  return {
    ok: false,
    command: 'npx',
    args: ['playwright', 'test', '--reporter=json'],
    exitCode: 1,
    stdout: '{"status":"failed"}',
    stderr: 'Playwright run failed',
    timedOut: false,
    error: 'Playwright run failed',
    ...overrides
  };
}

describe('execution classification and reporting', () => {
  it('maps failures to required deterministic buckets only', () => {
    const classifications = classifyExecutionFailures([
      {
        targetPath: 'tests/e2e/auth.spec.ts',
        message: 'Timeout 5000ms exceeded while waiting for locator("#submit")',
        stderr: 'locator timeout'
      },
      {
        targetPath: 'tests/e2e/checkout.spec.ts',
        message: 'expect(received).toBe(200) // received 500',
        stderr: 'internal server error'
      },
      {
        targetPath: 'tests/e2e/orders.spec.ts',
        message: 'connect ECONNREFUSED 127.0.0.1:3000',
        stderr: 'ECONNREFUSED'
      }
    ]);

    expect(classifications.map((item) => item.bucket)).toEqual([
      'test_authoring',
      'application_behavior',
      'environment_or_tooling'
    ]);
    expect(classifications.every((item) => item.bucketReason.length > 0)).toBe(true);
  });

  it('builds concise-first summary plus expandable raw stdout/stderr details', () => {
    const report = buildExecutionRunSummary({
      requestId: 'req_execution_summary_1',
      commandResult: makeCommandResult({
        stdout: 'stdout payload',
        stderr: 'stderr payload'
      }),
      passCount: 1,
      failCount: 2,
      failures: [
        {
          targetPath: 'tests/e2e/auth.spec.ts',
          message: 'Timeout 5000ms exceeded while waiting for locator("#submit")',
          stderr: 'locator timeout'
        },
        {
          targetPath: 'tests/e2e/checkout.spec.ts',
          message: 'expect(received).toBe(200) // received 500',
          stderr: 'internal server error'
        }
      ]
    });

    expect(report.summary.passCount).toBe(1);
    expect(report.summary.failCount).toBe(2);
    expect(report.summary.failingFiles).toEqual([
      'tests/e2e/auth.spec.ts',
      'tests/e2e/checkout.spec.ts'
    ]);
    expect(report.summary.topErrors).toHaveLength(2);

    expect(report.expandable.expandable).toBe(true);
    expect(report.expandable.rawStdout).toBe('stdout payload');
    expect(report.expandable.rawStderr).toBe('stderr payload');
    expect(report.expandable.failures[0]?.bucketReason).toContain('locator');
  });
});
