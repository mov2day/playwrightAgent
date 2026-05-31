import { QUICK_ACTIONS, type QuickAction } from '../../participant/actions';
import type { LintTypeGuardrailRunResult } from './lintTypeRunner';

const DEFAULT_MAX_ATTEMPTS = 1;
const MAX_ERROR_LINES = 3;

export interface ScopedAutoFixResult {
  ok: boolean;
  summary: string;
}

export interface LintTypeEscalationBundle {
  command: string;
  topErrors: string[];
  affectedFiles: string[];
  attemptedFixSummary: string;
  suggestedActions: QuickAction[];
}

export interface RetryEscalationOutcome {
  status: 'passed_no_retry' | 'passed_after_retry' | 'escalated';
  finalGuardrailResult: LintTypeGuardrailRunResult;
  retry: {
    attempts: number;
    maxAttempts: number;
    targetFiles: string[];
  };
  escalation?: LintTypeEscalationBundle;
}

export interface RetryEscalationInput {
  requestId: string;
  initialGuardrailResult: LintTypeGuardrailRunResult;
  targetFiles: readonly string[];
  applyScopedAutoFix: (targetFiles: readonly string[]) => Promise<ScopedAutoFixResult>;
  rerunGuardrail: () => Promise<LintTypeGuardrailRunResult>;
  maxAttempts?: number;
}

function normalizeTargetFiles(targetFiles: readonly string[]): string[] {
  return [...new Set(targetFiles.map((targetFile) => targetFile.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function clampRetryAttempts(maxAttempts?: number): number {
  const desiredAttempts = maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  // D-13: hard-cap retry loop to a single retry attempt.
  return Math.min(DEFAULT_MAX_ATTEMPTS, Math.max(1, Math.floor(desiredAttempts)));
}

function pickFailedCommand(result: LintTypeGuardrailRunResult): string {
  const failedStage = result.failedStage;
  if (!failedStage) {
    return 'npm run lint';
  }

  const failed = result.stageResults.find((stage) => stage.stage === failedStage);
  if (!failed) {
    return failedStage === 'typecheck' ? 'npm run typecheck' : 'npm run lint';
  }

  return [failed.result.command, ...failed.result.args].join(' ');
}

function extractTopErrors(result: LintTypeGuardrailRunResult): string[] {
  const failedStage = result.failedStage
    ? result.stageResults.find((stage) => stage.stage === result.failedStage)
    : result.stageResults.at(-1);
  const raw = [failedStage?.result.stderr, failedStage?.result.stdout, failedStage?.result.error]
    .filter((value): value is string => Boolean(value))
    .join('\n');

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const unique = [...new Set(lines)];

  if (unique.length === 0) {
    return ['Guardrail failed with no diagnostic output.'];
  }

  return unique.slice(0, MAX_ERROR_LINES);
}

function createEscalationBundle(
  guardrailResult: LintTypeGuardrailRunResult,
  targetFiles: string[],
  attemptedFixSummary: string
): LintTypeEscalationBundle {
  return {
    command: pickFailedCommand(guardrailResult),
    topErrors: extractTopErrors(guardrailResult),
    affectedFiles: [...targetFiles],
    attemptedFixSummary,
    suggestedActions: [...QUICK_ACTIONS]
  };
}

export async function resolveLintTypeRetryEscalation(
  input: RetryEscalationInput
): Promise<RetryEscalationOutcome> {
  const maxAttempts = clampRetryAttempts(input.maxAttempts);
  const scopedTargetFiles = normalizeTargetFiles(input.targetFiles);
  const initialResult = input.initialGuardrailResult;

  if (initialResult.status === 'passed') {
    return {
      status: 'passed_no_retry',
      finalGuardrailResult: initialResult,
      retry: {
        attempts: 0,
        maxAttempts,
        targetFiles: scopedTargetFiles
      }
    };
  }

  let attempts = 0;
  let lastGuardrailResult = initialResult;
  let lastFixSummary = 'No retry attempted.';

  while (attempts < maxAttempts) {
    attempts += 1;
    const fixResult = await input.applyScopedAutoFix(scopedTargetFiles);
    lastFixSummary = [
      `request=${input.requestId}`,
      `attempt=${attempts}/${maxAttempts}`,
      `scope=generated|updated targetFiles (${scopedTargetFiles.length})`,
      fixResult.summary
    ].join('; ');

    lastGuardrailResult = await input.rerunGuardrail();
    if (lastGuardrailResult.status === 'passed') {
      return {
        status: 'passed_after_retry',
        finalGuardrailResult: lastGuardrailResult,
        retry: {
          attempts,
          maxAttempts,
          targetFiles: scopedTargetFiles
        }
      };
    }
  }

  return {
    status: 'escalated',
    finalGuardrailResult: lastGuardrailResult,
    retry: {
      attempts,
      maxAttempts,
      targetFiles: scopedTargetFiles
    },
    escalation: createEscalationBundle(lastGuardrailResult, scopedTargetFiles, lastFixSummary)
  };
}
