import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 20_000;
const OUTPUT_LIMIT = 200_000;

interface SensitiveRedactionRule {
  id: string;
  pattern: RegExp;
  replacement: string;
}

const SENSITIVE_REDACTION_RULES: readonly SensitiveRedactionRule[] = [
  {
    id: 'authorization_pair',
    pattern: /((?:"|')?authorization(?:"|')?\s*[:=]\s*)(?:Bearer\s+[A-Za-z0-9._~+\/=-]+|"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi,
    replacement: '$1[REDACTED]'
  },
  {
    id: 'credential_pair',
    pattern: /((?:"|')?(?:x[-_]?api[_-]?key|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret)(?:"|')?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi,
    replacement: '$1[REDACTED]'
  },
  {
    id: 'bearer_token',
    pattern: /Bearer\s+[A-Za-z0-9._~+\/=-]+/gi,
    replacement: 'Bearer [REDACTED]'
  }
] as const;

export interface LocalToolCommandResult {
  ok: boolean;
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string;
}

function clampOutput(value: string): string {
  if (value.length <= OUTPUT_LIMIT) {
    return value;
  }
  return `${value.slice(0, OUTPUT_LIMIT)}\n...[truncated]`;
}

export function listAppliedRedactionRules(value: string): string[] {
  const matches = new Set<string>();
  for (const rule of SENSITIVE_REDACTION_RULES) {
    const testPattern = new RegExp(rule.pattern.source, rule.pattern.flags.replaceAll('g', ''));
    if (testPattern.test(value)) {
      matches.add(rule.id);
    }
  }
  return [...matches].sort((left, right) => left.localeCompare(right));
}

export function redactSensitiveText(value: string): string {
  return SENSITIVE_REDACTION_RULES.reduce((redacted, rule) => {
    return redacted.replace(rule.pattern, rule.replacement);
  }, value);
}

export function redactSensitiveValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      next[key] = redactSensitiveValue(nestedValue);
    }
    return next;
  }

  return value;
}

export async function runLocalToolCommand(
  command: string,
  args: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<LocalToolCommandResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return await new Promise<LocalToolCommandResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: controller.signal
    });

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (controller.signal.aborted) {
        timedOut = true;
      }

      clearTimeout(timeout);
      resolve({
        ok: false,
        command,
        args,
        exitCode: null,
        stdout: clampOutput(redactSensitiveText(stdout)),
        stderr: clampOutput(redactSensitiveText(stderr)),
        timedOut,
        error: redactSensitiveText(error.message)
      });
    });

    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({
        ok: exitCode === 0,
        command,
        args,
        exitCode,
        stdout: clampOutput(redactSensitiveText(stdout)),
        stderr: clampOutput(redactSensitiveText(stderr)),
        timedOut: timedOut || controller.signal.aborted,
        error: exitCode === 0 ? undefined : redactSensitiveText(stderr || `Command exited with ${exitCode}`)
      });
    });
  });
}
