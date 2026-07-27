import { describe, expect, it } from 'vitest';

import type { LocalToolCommandResult } from '../../src/adapters/localToolRunner';
import { InMemoryEventSink } from '../../src/adapters/eventSink';
import {
  createScopedRunRequest,
  type ScopedRunRequest
} from '../../src/pipeline/execution/contracts';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';
import { executeScopedRun } from '../../src/pipeline/execution/scopedRunExecutor';
import { handleExecutionRunRequest } from '../../src/participant/handler';

function makeCommandResult(overrides: Partial<LocalToolCommandResult> = {}): LocalToolCommandResult {
  return {
    ok: true,
    command: 'npx',
    args: ['playwright', 'test', '--reporter=json'],
    exitCode: 0,
    stdout: '{"status":"passed"}',
    stderr: '',
    timedOut: false,
    ...overrides
  };
}

function makePlaywrightJsonResult(overrides: {
  passCount?: number;
  failCount?: number;
  failures?: Array<{ file: string; message: string }>;
} = {}): string {
  const failures = overrides.failures ?? [];
  return JSON.stringify({
    suites: failures.map((failure) => ({
      file: failure.file,
      specs: [{
        title: failure.file,
        tests: [{
          results: [{
            status: 'failed',
            error: {
              message: failure.message
            }
          }]
        }]
      }]
    })),
    stats: {
      expected: overrides.passCount ?? 0,
      unexpected: overrides.failCount ?? failures.length
    }
  });
}

describe('execution run flow', () => {
  it('emits execution_command_preview before execution_run_started for generated/updated scope', async () => {
    const events: string[] = [];
    const runs: Array<{ command: string; args: string[] }> = [];
    const request = createScopedRunRequest({
      requestId: 'req_execution_1',
      generatedOrUpdatedTargets: [
        'tests/e2e/checkout.spec.ts',
        'tests/e2e/auth.spec.ts',
        'tests/e2e/auth.spec.ts'
      ]
    });

    const result = await executeScopedRun(request, {
      commandRunner: async (command, args) => {
        runs.push({ command, args });
        return makeCommandResult({ command, args });
      },
      emitEvent: (event) => {
        events.push(event.action);
      },
      now: () => new Date('2026-05-31T05:00:00.000Z')
    });

    expect(result.scopeMode).toBe('generated_or_updated');
    expect(result.targets).toEqual([
      'tests/e2e/auth.spec.ts',
      'tests/e2e/checkout.spec.ts'
    ]);
    expect(result.commandPreview.command).toBe('npx');
    expect(result.commandPreview.args).toEqual([
      'playwright',
      'test',
      'tests/e2e/auth.spec.ts',
      'tests/e2e/checkout.spec.ts',
      '--reporter=json'
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual({
      command: 'npx',
      args: [
        'playwright',
        'test',
        'tests/e2e/auth.spec.ts',
        'tests/e2e/checkout.spec.ts',
        '--reporter=json'
      ]
    });
    expect(events).toContain('execution_command_preview');
    expect(events).toContain('execution_run_started');
    expect(events.indexOf('execution_command_preview')).toBeLessThan(events.indexOf('execution_run_started'));
  });

  it('runs full suite only with explicit full_suite_opt_in scopeMode', async () => {
    const scoped: ScopedRunRequest = createScopedRunRequest({
      requestId: 'req_execution_2',
      generatedOrUpdatedTargets: ['tests/e2e/auth.spec.ts']
    });
    const fullSuite = createScopedRunRequest({
      requestId: 'req_execution_3',
      generatedOrUpdatedTargets: ['tests/e2e/auth.spec.ts'],
      scopeMode: 'full_suite_opt_in'
    });

    const scopedResult = await executeScopedRun(scoped, {
      commandRunner: async (command, args) => makeCommandResult({ command, args })
    });
    const fullSuiteResult = await executeScopedRun(fullSuite, {
      commandRunner: async (command, args) => makeCommandResult({ command, args })
    });

    expect(scopedResult.commandPreview.args).toEqual([
      'playwright',
      'test',
      'tests/e2e/auth.spec.ts',
      '--reporter=json'
    ]);
    expect(fullSuiteResult.commandPreview.args).toEqual([
      'playwright',
      'test',
      '--reporter=json'
    ]);
  });

  it('passes workspace cwd into scoped execution runner', async () => {
    const runnerCalls: Array<{ command: string; args: string[]; cwd?: string }> = [];

    await executeScopedRun(createScopedRunRequest({
      requestId: 'req_execution_cwd',
      generatedOrUpdatedTargets: ['tests/e2e/auth.spec.ts']
    }), {
      cwd: '/workspace/project',
      commandRunner: async (command, args, options) => {
        runnerCalls.push({
          command,
          args,
          cwd: options?.cwd
        });
        return makeCommandResult({ command, args });
      }
    });

    expect(runnerCalls).toEqual([{
      command: 'npx',
      args: [
        'playwright',
        'test',
        'tests/e2e/auth.spec.ts',
        '--reporter=json'
      ],
      cwd: '/workspace/project'
    }]);
  });

  it('fails closed when generated/updated scope has no targets', async () => {
    const result = await executeScopedRun(createScopedRunRequest({
      requestId: 'req_execution_4',
      generatedOrUpdatedTargets: []
    }), {
      commandRunner: async (command, args) => makeCommandResult({ command, args })
    });

    expect(result.result.ok).toBe(false);
    expect(result.result.error).toContain('No generated/updated targets available for scoped execution.');
  });

  it('runs scoped execution from participant trigger only after write completion', async () => {
    const sink = new InMemoryEventSink();
    const requestId = 'req_execution_5';
    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now: () => new Date('2026-06-01T04:00:00.000Z'),
      stageEntryGateEvaluator: (stage) => ({
        stage,
        blocked: false,
        fail_closed: false,
        requires_user_decision: false,
        reasons: [],
        manifest_hash: 'execution-run-flow'
      })
    });

    orchestrator.startSession(requestId, 'completed');

    const runResult = await handleExecutionRunRequest(requestId, {
      generatedOrUpdatedTargets: ['tests/e2e/account.spec.ts'],
      commandRunner: async (command, args) => makeCommandResult({
        command,
        args,
        stdout: makePlaywrightJsonResult({
          passCount: 2,
          failCount: 0
        })
      })
    }, {
      orchestrator
    });

    expect(runResult.ok).toBe(true);
    expect(runResult.run?.commandPreview.args).toEqual([
      'playwright',
      'test',
      'tests/e2e/account.spec.ts',
      '--reporter=json'
    ]);
    expect(runResult.runSummary?.summary.passCount).toBe(2);
    expect(runResult.runSummary?.summary.failCount).toBe(0);
    expect(runResult.runSummary?.summary.failingFiles).toEqual([]);
    expect(runResult.runSummary?.summary.topErrors).toEqual([]);
    expect(runResult.runSummary?.summary.bucketCounts).toEqual({
      test_authoring: 0,
      application_behavior: 0,
      environment_or_tooling: 0
    });
    const actions = sink.getEvents().map((event) => event.action);
    expect(actions.indexOf('execution_run_requested')).toBeGreaterThanOrEqual(0);
    expect(actions.indexOf('execution_command_preview')).toBeGreaterThan(actions.indexOf('execution_run_requested'));
  });

  it('blocks participant run trigger before workflow reaches completed state', async () => {
    const sink = new InMemoryEventSink();
    const requestId = 'req_execution_6';
    const orchestrator = new PipelineOrchestrator({
      eventSink: sink,
      now: () => new Date('2026-06-01T05:00:00.000Z'),
      stageEntryGateEvaluator: (stage) => ({
        stage,
        blocked: false,
        fail_closed: false,
        requires_user_decision: false,
        reasons: [],
        manifest_hash: 'execution-run-flow'
      })
    });

    orchestrator.startSession(requestId, 'ready_to_write');

    const runResult = await handleExecutionRunRequest(requestId, {
      generatedOrUpdatedTargets: ['tests/e2e/account.spec.ts'],
      commandRunner: async (command, args) => makeCommandResult({ command, args })
    }, {
      orchestrator
    });

    expect(runResult.ok).toBe(false);
    expect(runResult.errorCode).toBe('ILLEGAL_TRANSITION');
  });
});
