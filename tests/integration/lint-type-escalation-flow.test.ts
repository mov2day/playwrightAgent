import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import type { LocalToolCommandResult } from '../../src/adapters/localToolRunner';
import {
  runPostWriteLintTypeGuardrail,
  type LintTypeGuardrailRunResult
} from '../../src/pipeline/guardrails/lintTypeRunner';
import { resolveLintTypeRetryEscalation } from '../../src/pipeline/guardrails/retryEscalation';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';
import { handleGuardrailDecision } from '../../src/participant/handler';
import { createPreviewApproveAllAction } from '../../src/ui/previewActions';

const TEMP_DIRS: string[] = [];

function makeTempWriteRoot(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwagent-guardrail-'));
  TEMP_DIRS.push(rootDir);
  return rootDir;
}

afterEach(() => {
  for (const tempDir of TEMP_DIRS) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  TEMP_DIRS.length = 0;
});

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

  it('passes workspace cwd to lint/type command runner', async () => {
    const executed: Array<{ command: string; args: string[]; cwd?: string }> = [];

    const result = await runPostWriteLintTypeGuardrail({
      cwd: '/workspace/project',
      commandRunner: async (command, args, options) => {
        executed.push({
          command,
          args,
          cwd: options?.cwd
        });
        return makeCommandResult({
          command,
          args
        });
      }
    });

    expect(result.status).toBe('passed');
    expect(executed).toEqual([
      { command: 'npm', args: ['run', 'lint'], cwd: '/workspace/project' },
      { command: 'npm', args: ['run', 'typecheck'], cwd: '/workspace/project' }
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

  it('blocks pipeline in awaiting_guardrail_decision until explicit decision resolves guardrail_failed state', async () => {
    const rootDir = makeTempWriteRoot();
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-05-31T04:00:00.000Z');
    const requestId = 'req_guardrail_blocked_1';
    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now,
      rootDir,
      stageEntryGateEvaluator: (stage) => ({
        stage,
        blocked: false,
        fail_closed: false,
        requires_user_decision: false,
        reasons: [],
        manifest_hash: 'guardrail-test'
      })
    });

    orchestrator.startSession(requestId, 'ready_to_write');
    expect(orchestrator.setPreviewVersion(requestId, 'preview.guardrail.v1')).toBe(true);
    expect(orchestrator.applyPreviewAction(
      requestId,
      createPreviewApproveAllAction(requestId, 1, 'chat', 'preview.guardrail.v1')
    ).ok).toBe(true);

    const result = await orchestrator.executeWritePlanWithGuardrails(requestId, [
      {
        targetPath: 'tests/e2e/guardrail.generated.spec.ts',
        mode: 'create_scoped',
        scenarioIds: ['scn_guardrail_1'],
        generatedBlock: 'test("guardrail generated", async () => {});'
      }
    ], {
      commandRunner: async (command, args) => makeCommandResult({
        ok: false,
        command,
        args,
        exitCode: 1,
        stderr: 'guardrail lint error',
        error: 'lint/type failed'
      }),
      applyScopedAutoFix: async (targetFiles) => ({
        ok: false,
        summary: `No auto-fix for ${targetFiles.length} generated files.`
      })
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('GUARDRAIL_ESCALATION_REQUIRED');
    expect(result.to).toBe('awaiting_guardrail_decision');
    expect(orchestrator.getSession(requestId)?.state).toBe('awaiting_guardrail_decision');
    expect(orchestrator.getPendingGuardrailEscalation(requestId)?.suggestedActions).toEqual([
      'approve',
      'reject',
      'continue',
      'cancel'
    ]);

    const continueResult = handleGuardrailDecision(requestId, 'continue', 'Fixed lint manually.', {
      orchestrator
    });

    expect(continueResult.ok).toBe(true);
    expect(continueResult.from).toBe('awaiting_guardrail_decision');
    expect(continueResult.to).toBe('ready_to_write');
    expect(orchestrator.getSession(requestId)?.state).toBe('ready_to_write');
    expect(orchestrator.getSession(requestId)?.guardrailDecisionHistory.at(-1)).toMatchObject({
      action: 'continue',
      comment: 'Fixed lint manually.'
    });
  });

  it('accepts only approve/reject/continue/cancel to resolve blocked guardrail escalation', async () => {
    const rootDir = makeTempWriteRoot();
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-05-31T04:30:00.000Z');
    const requestId = 'req_guardrail_blocked_2';
    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now,
      rootDir,
      stageEntryGateEvaluator: (stage) => ({
        stage,
        blocked: false,
        fail_closed: false,
        requires_user_decision: false,
        reasons: [],
        manifest_hash: 'guardrail-test'
      })
    });

    orchestrator.startSession(requestId, 'ready_to_write');
    expect(orchestrator.setPreviewVersion(requestId, 'preview.guardrail.v2')).toBe(true);
    expect(orchestrator.applyPreviewAction(
      requestId,
      createPreviewApproveAllAction(requestId, 1, 'chat', 'preview.guardrail.v2')
    ).ok).toBe(true);

    const blockedResult = await orchestrator.executeWritePlanWithGuardrails(requestId, [
      {
        targetPath: 'tests/e2e/guardrail.generated.spec.ts',
        mode: 'create_scoped',
        scenarioIds: ['scn_guardrail_2'],
        generatedBlock: 'test("guardrail generated 2", async () => {});'
      }
    ], {
      commandRunner: async (command, args) => makeCommandResult({
        ok: false,
        command,
        args,
        exitCode: 1,
        stderr: 'typecheck failure',
        error: 'typecheck failed'
      }),
      applyScopedAutoFix: async () => ({
        ok: false,
        summary: 'Retry attempted once and failed.'
      })
    });

    expect(blockedResult.ok).toBe(false);
    expect(orchestrator.getSession(requestId)?.state).toBe('awaiting_guardrail_decision');

    const invalid = orchestrator.applyGuardrailDecision(
      requestId,
      'retry' as unknown as Parameters<typeof orchestrator.applyGuardrailDecision>[1],
      'retry not allowed'
    );
    expect(invalid.ok).toBe(false);
    expect(invalid.errorCode).toBe('UNMAPPED_ACTION');
    expect(orchestrator.getSession(requestId)?.state).toBe('awaiting_guardrail_decision');

    const rejectResult = handleGuardrailDecision(requestId, 'reject', 'Rejecting failing guardrail run.', {
      orchestrator
    });

    expect(rejectResult.ok).toBe(true);
    expect(rejectResult.to).toBe('cancelled');
    expect(orchestrator.getSession(requestId)?.state).toBe('cancelled');
  });
});
