import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runLocalToolCommand } from '../../src/adapters/localToolRunner';

const TEMP_DIRS: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwagent-runner-'));
  TEMP_DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of TEMP_DIRS) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  TEMP_DIRS.length = 0;
});

describe('runLocalToolCommand', () => {
  it('runs commands from provided cwd', async () => {
    const cwd = makeTempDir();
    const nested = path.join(cwd, 'nested');
    fs.mkdirSync(nested);

    const result = await runLocalToolCommand(
      'node',
      ['-e', 'console.log(process.cwd())'],
      {
        cwd: nested,
        timeoutMs: 5_000
      }
    );

    expect(result.ok).toBe(true);
    expect(result.stdout.trim()).toBe(fs.realpathSync(nested));
  });
});
