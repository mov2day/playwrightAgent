import { describe, expect, it } from 'vitest';

import type { LocalToolCommandResult } from '../../src/adapters/localToolRunner';
import { InMemoryEventSink } from '../../src/adapters/eventSink';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';
import { handleExecutionGuardrailDecision } from '../../src/participant/handler';

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
      commandRunner: async (command: string, args: string[]) => {
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
      applyScopedAutoFix: async (targetFiles: readonly string[]) => {
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
      commandRunner: async (command: string, args: string[]) => makeCommandResult({
        command,
        args,
        stderr: 'expect(received).toBe(200) // received 500',
        error: 'received 500'
      }),
      applyScopedAutoFix: async (targetFiles: readonly string[]) => ({
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
      attemptedFixSummary: expect.stringContaining('Scoped fix failed for 2 generated|updated files.'),
      suggestedActions: ['approve', 'reject', 'continue', 'cancel']
    });
    expect(result.escalation?.topErrors.length).toBeGreaterThan(0);
    expect(result.runSummary?.summary.bucketCounts.test_authoring).toBeGreaterThan(0);
    expect(result.runSummary?.expandable.failures[0]).toMatchObject({
      bucket: 'test_authoring',
      bucketReason: expect.stringContaining('Assertion wiring')
    });
    const escalatedEvent = sink.getEvents().find((event) => event.action === 'execution_run_escalated');
    expect(escalatedEvent?.details?.failureDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        bucket: 'test_authoring',
        bucketReason: expect.stringContaining('Assertion wiring')
      })
    ]));
    expect(orchestrator.getSession(requestId)?.state).toBe('awaiting_guardrail_decision');
  });

  it('continue records manual fix and reruns identical scoped command', async () => {
    const sink = new InMemoryEventSink();
    const requestId = 'req_execution_retry_3';
    const initialCommands: string[] = [];
    const rerunCommands: string[] = [];
    let firstPhase = true;

    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now: () => new Date('2026-06-01T08:00:00.000Z'),
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

    const escalated = await orchestrator.executeScopedRun(requestId, {
      generatedOrUpdatedTargets: ['tests/e2e/profile.spec.ts'],
      commandRunner: async (command: string, args: string[]) => {
        initialCommands.push([command, ...args].join(' '));
        return makeCommandResult({
          command,
          args,
          stderr: 'expect(locator).toBeVisible() failed',
          error: 'selector mismatch'
        });
      },
      applyScopedAutoFix: async () => ({
        ok: false,
        summary: 'One-shot fix did not resolve failure.'
      })
    } as unknown as Parameters<typeof orchestrator.executeScopedRun>[1]);

    expect(escalated.errorCode).toBe('GUARDRAIL_ESCALATION_REQUIRED');
    expect(orchestrator.getSession(requestId)?.state).toBe('awaiting_guardrail_decision');

    const continued = await handleExecutionGuardrailDecision(requestId, 'continue', 'Manual selector fix applied.', {
      orchestrator,
      executionRunOptions: {
        commandRunner: async (command, args) => {
          rerunCommands.push([command, ...args].join(' '));
          if (firstPhase) {
            firstPhase = false;
            return makeCommandResult({
              ok: true,
              command,
              args,
              exitCode: 0,
              stdout: '{"status":"passed"}',
              stderr: '',
              error: undefined
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
        }
      }
    });

    expect(continued.ok).toBe(true);
    expect(orchestrator.getSession(requestId)?.state).toBe('completed');
    expect(initialCommands[0]).toBe(rerunCommands[0]);
    const events = sink.getEvents().map((event) => event.action);
    expect(events).toContain('manual_fix_confirmed');
    expect(events).toContain('execution_rerun_requested');
    expect(events).toContain('guardrail_decision_recorded');
  });

  it('approve/reject/cancel produce explicit execution decision events', async () => {
    const baseNow = new Date('2026-06-01T09:00:00.000Z');

    for (const action of ['approve', 'reject', 'cancel'] as const) {
      const sink = new InMemoryEventSink();
      const requestId = `req_execution_retry_${action}`;
      const orchestrator = new PipelineOrchestrator({
        eventSink: sink,
        now: () => baseNow,
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

      const escalated = await orchestrator.executeScopedRun(requestId, {
        generatedOrUpdatedTargets: ['tests/e2e/profile.spec.ts'],
        commandRunner: async (command: string, args: string[]) => makeCommandResult({
          command,
          args,
          stderr: 'still failing',
          error: 'still failing'
        }),
        applyScopedAutoFix: async () => ({
          ok: false,
          summary: 'No fix'
        })
      } as unknown as Parameters<typeof orchestrator.executeScopedRun>[1]);

      expect(escalated.errorCode).toBe('GUARDRAIL_ESCALATION_REQUIRED');

      const decision = await handleExecutionGuardrailDecision(requestId, action, `${action} decision`, {
        orchestrator
      });

      expect(decision.ok).toBe(true);
      const events = sink.getEvents().map((event) => event.action);
      if (action === 'approve') {
        expect(orchestrator.getSession(requestId)?.state).toBe('completed');
        expect(events).toContain('execution_decision_approved');
      } else if (action === 'reject') {
        expect(orchestrator.getSession(requestId)?.state).toBe('cancelled');
        expect(events).toContain('execution_decision_rejected');
      } else {
        expect(orchestrator.getSession(requestId)?.state).toBe('cancelled');
        expect(events).toContain('execution_decision_cancelled');
      }
    }
  });
});
