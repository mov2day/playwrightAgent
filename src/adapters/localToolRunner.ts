import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 20_000;
const OUTPUT_LIMIT = 200_000;

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

export function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret)\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]');
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
