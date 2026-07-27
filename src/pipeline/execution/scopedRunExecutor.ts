import {
  redactSensitiveText,
  runLocalToolCommand,
  type LocalToolCommandResult,
  type LocalToolRunner
} from '../../adapters/localToolRunner';
import { createPipelineEvent, type PipelineStageEvent } from '../events';
import type {
  ScopedRunCommandPreview,
  ScopedRunRequest
} from './contracts';

const OUTPUT_CLAMP_LIMIT = 20_000;

type LocalCommandRunner = LocalToolRunner;

export interface ScopedRunExecutorDeps {
  commandRunner?: LocalCommandRunner;
  emitEvent?: (event: PipelineStageEvent) => void;
  now?: () => Date;
  cwd?: string;
}

export interface ScopedRunExecutionResult {
  requestId: string;
  scopeMode: ScopedRunRequest['scopeMode'];
  targets: string[];
  commandPreview: ScopedRunCommandPreview;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  result: LocalToolCommandResult;
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
  return {
    ...result,
    command,
    args: [...args],
    stdout: clampOutput(redactSensitiveText(result.stdout ?? '')),
    stderr: clampOutput(redactSensitiveText(result.stderr ?? '')),
    timedOut: Boolean(result.timedOut),
    error: result.error ? clampOutput(redactSensitiveText(result.error)) : undefined
  };
}

function buildScopedRunArgs(request: ScopedRunRequest): string[] {
  const args = ['playwright', 'test'];
  if (request.scopeMode !== 'full_suite_opt_in') {
    args.push(...request.targets);
  }
  args.push('--reporter=json');
  return args;
}

function toDisplay(command: string, args: readonly string[]): string {
  return [command, ...args].join(' ');
}

function buildNoTargetsResult(commandPreview: ScopedRunCommandPreview): LocalToolCommandResult {
  return {
    ok: false,
    command: commandPreview.command,
    args: [...commandPreview.args],
    exitCode: null,
    stdout: '',
    stderr: '',
    timedOut: false,
    error: 'No generated/updated targets available for scoped execution.'
  };
}

export function buildScopedRunCommandPreview(request: ScopedRunRequest): ScopedRunCommandPreview {
  const command = 'npx';
  const args = buildScopedRunArgs(request);
  return {
    command,
    args,
    display: toDisplay(command, args)
  };
}

export async function executeScopedRun(
  request: ScopedRunRequest,
  deps: ScopedRunExecutorDeps = {}
): Promise<ScopedRunExecutionResult> {
  const commandRunner = deps.commandRunner ?? runLocalToolCommand;
  const now = deps.now ?? (() => new Date());
  const commandPreview = buildScopedRunCommandPreview(request);
  const startedAt = now();

  deps.emitEvent?.(createPipelineEvent({
    requestId: request.requestId,
    stage: 'orchestrator',
    action: 'execution_command_preview',
    details: {
      scopeMode: request.scopeMode,
      targetSource: request.targetSource,
      commandPreview
    }
  }, now));

  if (request.scopeMode !== 'full_suite_opt_in' && request.targets.length === 0) {
    const completedAt = now();
    const result = buildNoTargetsResult(commandPreview);

    deps.emitEvent?.(createPipelineEvent({
      requestId: request.requestId,
      stage: 'orchestrator',
      action: 'execution_run_blocked',
      details: {
        scopeMode: request.scopeMode,
        reason: result.error
      }
    }, now));

    return {
      requestId: request.requestId,
      scopeMode: request.scopeMode,
      targets: [...request.targets],
      commandPreview,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      result
    };
  }

  deps.emitEvent?.(createPipelineEvent({
    requestId: request.requestId,
    stage: 'orchestrator',
    action: 'execution_run_started',
    details: {
      scopeMode: request.scopeMode,
      targetCount: request.targets.length
    }
  }, now));

  const rawResult = await commandRunner(commandPreview.command, commandPreview.args, {
    cwd: deps.cwd
  });
  const completedAt = now();
  const result = sanitizeCommandResult(rawResult, commandPreview.command, commandPreview.args);

  deps.emitEvent?.(createPipelineEvent({
    requestId: request.requestId,
    stage: 'orchestrator',
    action: 'execution_run_completed',
    details: {
      scopeMode: request.scopeMode,
      ok: result.ok,
      exitCode: result.exitCode,
      timedOut: result.timedOut
    }
  }, now));

  return {
    requestId: request.requestId,
    scopeMode: request.scopeMode,
    targets: [...request.targets],
    commandPreview,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    result
  };
}
