import {
  redactSensitiveText,
  runLocalToolCommand,
  type LocalToolCommandResult
} from '../../adapters/localToolRunner';

const OUTPUT_CLAMP_LIMIT = 20_000;

export type LintTypeGuardrailStage = 'lint' | 'typecheck';
export type LintTypeGuardrailStatus = 'passed' | 'failed_needs_retry';

interface GuardrailCommandSpec {
  stage: LintTypeGuardrailStage;
  command: string;
  args: string[];
}

const DEFAULT_GUARDRAIL_COMMANDS: readonly GuardrailCommandSpec[] = [
  { stage: 'lint', command: 'npm', args: ['run', 'lint'] },
  { stage: 'typecheck', command: 'npm', args: ['run', 'typecheck'] }
];

export interface LintTypeGuardrailStageResult {
  stage: LintTypeGuardrailStage;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  result: LocalToolCommandResult;
}

export interface LintTypeGuardrailRunResult {
  status: LintTypeGuardrailStatus;
  stageResults: LintTypeGuardrailStageResult[];
  failedStage?: LintTypeGuardrailStage;
}

export interface LintTypeRunnerDeps {
  commandRunner?: (
    command: string,
    args: string[]
  ) => Promise<LocalToolCommandResult>;
  now?: () => Date;
}

function clampOutput(value: string): string {
  if (value.length <= OUTPUT_CLAMP_LIMIT) {
    return value;
  }

  return `${value.slice(0, OUTPUT_CLAMP_LIMIT)}\n...[truncated]`;
}

function sanitizeCommandResult(
  result: LocalToolCommandResult,
  command: string,
  args: string[]
): LocalToolCommandResult {
  const stdout = clampOutput(redactSensitiveText(result.stdout ?? ''));
  const stderr = clampOutput(redactSensitiveText(result.stderr ?? ''));

  return {
    ...result,
    command,
    args: [...args],
    stdout,
    stderr,
    timedOut: Boolean(result.timedOut),
    error: result.error ? clampOutput(redactSensitiveText(result.error)) : undefined
  };
}

export async function runPostWriteLintTypeGuardrail(
  deps: LintTypeRunnerDeps = {}
): Promise<LintTypeGuardrailRunResult> {
  const commandRunner = deps.commandRunner ?? runLocalToolCommand;
  const now = deps.now ?? (() => new Date());
  const stageResults: LintTypeGuardrailStageResult[] = [];

  for (const spec of DEFAULT_GUARDRAIL_COMMANDS) {
    const startedAt = now();
    const commandResult = await commandRunner(spec.command, spec.args);
    const completedAt = now();
    const sanitizedResult = sanitizeCommandResult(commandResult, spec.command, spec.args);

    stageResults.push({
      stage: spec.stage,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      result: sanitizedResult
    });

    if (!sanitizedResult.ok) {
      return {
        status: 'failed_needs_retry',
        stageResults,
        failedStage: spec.stage
      };
    }
  }

  return {
    status: 'passed',
    stageResults
  };
}
