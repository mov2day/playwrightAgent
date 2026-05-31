import { describe, expect, it } from 'vitest';

import type { LocalToolCommandResult } from '../../src/adapters/localToolRunner';
import {
  runPostWriteLintTypeGuardrail,
  type LintTypeGuardrailRunResult
} from '../../src/pipeline/guardrails/lintTypeRunner';
import { resolveLintTypeRetryEscalation } from '../../src/pipeline/guardrails/retryEscalation';

function makeCommandResult(overrides: Partial<LocalToolCommandResult> = {}): LocalToolCommandResult {
  return {
    ok: true,
    command: 'npm',
    args: ['run', 'lint'],
    exitCode: 0,
    stdout: 'ok',
    stderr: '',
    timedOut: false,
    ...overrides
  };
}

function makeGuardrailResult(overrides: Partial<LintTypeGuardrailRunResult> = {}): LintTypeGuardrailRunResult {
  return {
    status: 'passed',
    stageResults: [
      {
        stage: 'lint',
        startedAt: '2026-05-31T00:00:00.000Z',
        completedAt: '2026-05-31T00:00:01.000Z',
        durationMs: 1000,
        result: makeCommandResult({
          command: 'npm',
          args: ['run', 'lint'],
          stdout: 'lint ok'
        })
      }
    ],
    ...overrides
  };
}

describe('lint/type escalation flow', () => {
  it('runs lint then typecheck in deterministic sequence when first pass succeeds', async () => {
    const executed: Array<{ command: string; args: string[] }> = [];
    const commandRunner = async (command: string, args: string[]) => {
      executed.push({ command, args });
      if (args[1] === 'lint') {
        return makeCommandResult({
          command,
          args,
          stdout: 'lint ok'
        });
      }

      return makeCommandResult({
        command,
        args,
        stdout: 'type ok'
      });
    };

    const result = await runPostWriteLintTypeGuardrail({ commandRunner });

    expect(result.status).toBe('passed');
    expect(result.stageResults).toHaveLength(2);
    expect(executed).toEqual([
      { command: 'npm', args: ['run', 'lint'] },
      { command: 'npm', args: ['run', 'typecheck'] }
    ]);
  });

  it('returns structured failure details requiring retry when lint fails first pass', async () => {
    const commandRunner = async (command: string, args: string[]) => makeCommandResult({
      ok: false,
      command,
      args,
      exitCode: 1,
      stdout: 'lint failure',
      stderr: 'Authorization: Bearer super-secret-token',
      error: 'lint failed'
    });

    const result = await runPostWriteLintTypeGuardrail({ commandRunner });

    expect(result.status).toBe('failed_needs_retry');
    expect(result.failedStage).toBe('lint');
    expect(result.stageResults[0]?.result.stdout).toContain('lint failure');
    expect(result.stageResults[0]?.result.stderr).toContain('Authorization:');
    expect(result.stageResults[0]?.result.stderr).toContain('[REDACTED]');
    expect(result.stageResults[0]?.result.timedOut).toBe(false);
  });

  it('allows exactly one scoped retry and resolves when retry pass succeeds', async () => {
    let reruns = 0;
    let fixedScope: readonly string[] = [];
    const initial = makeGuardrailResult({
      status: 'failed_needs_retry',
      failedStage: 'lint'
    });

    const outcome = await resolveLintTypeRetryEscalation({
      requestId: 'req_retry_pass',
      initialGuardrailResult: initial,
      targetFiles: ['tests/e2e/auth.spec.ts', 'tests/e2e/auth.spec.ts', 'tests/e2e/cart.spec.ts'],
      applyScopedAutoFix: async (targetFiles) => {
        fixedScope = targetFiles;
        return {
          ok: true,
          summary: 'Scoped autofix updated generated files only.'
        };
      },
      rerunGuardrail: async () => {
        reruns += 1;
        return makeGuardrailResult({
          status: 'passed',
          stageResults: [
            {
              stage: 'lint',
              startedAt: '2026-05-31T00:00:00.000Z',
              completedAt: '2026-05-31T00:00:01.000Z',
              durationMs: 1000,
              result: makeCommandResult({
                command: 'npm',
                args: ['run', 'lint'],
                stdout: 'lint ok'
              })
            },
            {
              stage: 'typecheck',
              startedAt: '2026-05-31T00:00:01.000Z',
              completedAt: '2026-05-31T00:00:02.000Z',
              durationMs: 1000,
              result: makeCommandResult({
                command: 'npm',
                args: ['run', 'typecheck'],
                stdout: 'typecheck ok'
              })
            }
          ]
        });
      }
    });

    expect(outcome.status).toBe('passed_after_retry');
    expect(outcome.retry.attempts).toBe(1);
    expect(outcome.retry.maxAttempts).toBe(1);
    expect(outcome.retry.targetFiles).toEqual(['tests/e2e/auth.spec.ts', 'tests/e2e/cart.spec.ts']);
    expect(fixedScope).toEqual(['tests/e2e/auth.spec.ts', 'tests/e2e/cart.spec.ts']);
    expect(reruns).toBe(1);
  });

  it('emits structured escalation bundle after one failed retry', async () => {
    let reruns = 0;
    let fixes = 0;
    const initial = makeGuardrailResult({
      status: 'failed_needs_retry',
      failedStage: 'typecheck',
      stageResults: [
        {
          stage: 'lint',
          startedAt: '2026-05-31T00:00:00.000Z',
          completedAt: '2026-05-31T00:00:01.000Z',
          durationMs: 1000,
          result: makeCommandResult({
            command: 'npm',
            args: ['run', 'lint']
          })
        },
        {
          stage: 'typecheck',
          startedAt: '2026-05-31T00:00:01.000Z',
          completedAt: '2026-05-31T00:00:02.000Z',
          durationMs: 1000,
          result: makeCommandResult({
            ok: false,
            command: 'npm',
            args: ['run', 'typecheck'],
            exitCode: 2,
            stderr: 'error TS2322: Type mismatch at tests/e2e/checkout.spec.ts:41:7',
            error: 'Typecheck failed'
          })
        }
      ]
    });

    const outcome = await resolveLintTypeRetryEscalation({
      requestId: 'req_retry_fail',
      initialGuardrailResult: initial,
      targetFiles: ['tests/e2e/checkout.spec.ts', 'tests/e2e/auth.spec.ts'],
      applyScopedAutoFix: async () => {
        fixes += 1;
        return {
          ok: false,
          summary: 'Attempted quick fix in scoped generated files.'
        };
      },
      rerunGuardrail: async () => {
        reruns += 1;
        return makeGuardrailResult({
          status: 'failed_needs_retry',
          failedStage: 'typecheck',
          stageResults: [
            {
              stage: 'lint',
              startedAt: '2026-05-31T00:00:00.000Z',
              completedAt: '2026-05-31T00:00:01.000Z',
              durationMs: 1000,
              result: makeCommandResult({
                command: 'npm',
                args: ['run', 'lint']
              })
            },
            {
              stage: 'typecheck',
              startedAt: '2026-05-31T00:00:01.000Z',
              completedAt: '2026-05-31T00:00:02.000Z',
              durationMs: 1000,
              result: makeCommandResult({
                ok: false,
                command: 'npm',
                args: ['run', 'typecheck'],
                exitCode: 2,
                stderr: 'error TS2554: Expected 2 arguments, got 1.',
                error: 'Typecheck still failing'
              })
            }
          ]
        });
      }
    });

    expect(outcome.status).toBe('escalated');
    expect(outcome.retry.attempts).toBe(1);
    expect(outcome.retry.maxAttempts).toBe(1);
    expect(outcome.retry.targetFiles).toEqual(['tests/e2e/auth.spec.ts', 'tests/e2e/checkout.spec.ts']);
    expect(fixes).toBe(1);
    expect(reruns).toBe(1);

    expect(outcome.escalation).toMatchObject({
      command: 'npm run typecheck',
      affectedFiles: ['tests/e2e/auth.spec.ts', 'tests/e2e/checkout.spec.ts']
    });
    expect(outcome.escalation?.topErrors.length).toBeGreaterThan(0);
    expect(outcome.escalation?.attemptedFixSummary).toContain('Attempted quick fix');
    expect(outcome.escalation?.suggestedActions).toEqual(['approve', 'reject', 'continue', 'cancel']);
  });
});
