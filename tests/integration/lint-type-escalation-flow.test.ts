import { describe, expect, it } from 'vitest';

import type { LocalToolCommandResult } from '../../src/adapters/localToolRunner';
import { runPostWriteLintTypeGuardrail } from '../../src/pipeline/guardrails/lintTypeRunner';

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
    expect(result.stageResults[0]?.result.stderr).toContain('Bearer [REDACTED]');
    expect(result.stageResults[0]?.result.timedOut).toBe(false);
  });
});
