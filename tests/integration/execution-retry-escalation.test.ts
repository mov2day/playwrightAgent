import { describe, expect, it } from 'vitest';

import type { LocalToolCommandResult } from '../../src/adapters/localToolRunner';
import { InMemoryEventSink } from '../../src/adapters/eventSink';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';

function makeCommandResult(overrides: Partial<LocalToolCommandResult> = {}): LocalToolCommandResult {
  return {
    ok: false,
    command: 'npx',
    args: ['playwright', 'test', '--reporter=json'],
    exitCode: 1,
    stdout: '',
    stderr: 'playwright failure',
    timedOut: false,
    error: 'playwright failure',
    ...overrides
  };
}

describe('execution retry escalation', () => {
  it('attempts exactly one scoped auto-fix retry before succeeding', async () => {
    const sink = new InMemoryEventSink();
    const requestId = 'req_execution_retry_1';
    const runCalls: Array<{ command: string; args: string[] }> = [];
    const scopedFixTargets: string[][] = [];
    let attempts = 0;

    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now: () => new Date('2026-06-01T06:00:00.000Z'),
      stageEntryGateEvaluator: (stage) => ({
        stage,
        blocked: false,
        fail_closed: false,
        requires_user_decision: false,
        reasons: [],
        manifest_hash: 'execution-retry'
      })
    });
    orchestrator.startSession(requestId, 'completed');

    const result = await orchestrator.executeScopedRun(requestId, {
      generatedOrUpdatedTargets: ['tests/e2e/new-login.spec.ts'],
      commandRunner: async (command, args) => {
        runCalls.push({ command, args });
        attempts += 1;
        if (attempts === 1) {
          return makeCommandResult({
            command,
            args,
            stderr: 'expect(received).toBeVisible() failed'
          });
        }
        return makeCommandResult({
          ok: true,
          command,
          args,
          exitCode: 0,
          stdout: '{"status":"passed"}',
          stderr: '',
          error: undefined
        });
      },
      applyScopedAutoFix: async (targetFiles) => {
        scopedFixTargets.push([...targetFiles]);
        return {
          ok: true,
          summary: 'Applied scoped selector fix.'
        };
      }
    } as unknown as Parameters<typeof orchestrator.executeScopedRun>[1]);

    expect(result.ok).toBe(true);
    expect(runCalls).toHaveLength(2);
    expect(scopedFixTargets).toEqual([['tests/e2e/new-login.spec.ts']]);
    expect(result.guardrail?.retry.maxAttempts).toBe(1);
    expect(result.guardrail?.retry.attempts).toBe(1);
  });

  it('returns escalation bundle and blocks flow when one-shot retry still fails', async () => {
    const sink = new InMemoryEventSink();
    const requestId = 'req_execution_retry_2';
    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now: () => new Date('2026-06-01T07:00:00.000Z'),
      stageEntryGateEvaluator: (stage) => ({
        stage,
        blocked: false,
        fail_closed: false,
        requires_user_decision: false,
        reasons: [],
        manifest_hash: 'execution-retry'
      })
    });
    orchestrator.startSession(requestId, 'completed');

    const result = await orchestrator.executeScopedRun(requestId, {
      generatedOrUpdatedTargets: [
        'tests/e2e/new-login.spec.ts',
        'tests/e2e/new-checkout.spec.ts'
      ],
      commandRunner: async (command, args) => makeCommandResult({
        command,
        args,
        stderr: 'expect(received).toBe(200) // received 500',
        error: 'received 500'
      }),
      applyScopedAutoFix: async (targetFiles) => ({
        ok: false,
        summary: `Scoped fix failed for ${targetFiles.length} generated|updated files.`
      })
    } as unknown as Parameters<typeof orchestrator.executeScopedRun>[1]);

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('GUARDRAIL_ESCALATION_REQUIRED');
    expect(result.to).toBe('awaiting_guardrail_decision');
    expect(result.escalation).toMatchObject({
      command: 'npx playwright test tests/e2e/new-checkout.spec.ts tests/e2e/new-login.spec.ts --reporter=json',
      affectedFiles: ['tests/e2e/new-checkout.spec.ts', 'tests/e2e/new-login.spec.ts'],
      attemptedFixSummary: 'Scoped fix failed for 2 generated|updated files.',
      suggestedActions: ['approve', 'reject', 'continue', 'cancel']
    });
    expect(result.escalation?.topErrors.length).toBeGreaterThan(0);
    expect(orchestrator.getSession(requestId)?.state).toBe('awaiting_guardrail_decision');
  });
});
