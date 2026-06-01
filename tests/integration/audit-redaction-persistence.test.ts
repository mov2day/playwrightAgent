import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AuditFileSink } from '../../src/adapters/auditFileSink';

describe('audit redaction persistence', () => {
  it('persists request-scoped redacted NDJSON with deterministic evidence', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwagent-audit-'));
    try {
      const sink = new AuditFileSink({
        rootDir,
        now: () => new Date('2026-06-01T10:00:00.000Z')
      });

      sink.emit({
        requestId: 'req_redaction_1',
        stage: 'gate',
        action: 'guardrail_decision_recorded',
        timestamp: '2026-06-01T09:59:59.000Z',
        details: {
          authorization: 'Bearer super-secret-token',
          token: 'token=abc123',
          nested: {
            api_key: 'api_key=xyz789'
          }
        }
      });

      const auditFilePath = path.join(rootDir, '.planning', 'logs', 'audit', 'req_redaction_1.ndjson');
      expect(fs.existsSync(auditFilePath)).toBe(true);

      const lines = fs.readFileSync(auditFilePath, 'utf8').trim().split('\n');
      expect(lines).toHaveLength(1);

      const record = JSON.parse(lines[0] ?? '{}') as {
        requestId: string;
        schemaVersion: string;
        details: Record<string, unknown>;
        redactionEvidence: {
          redacted: boolean;
          fieldCount: number;
          appliedRules: string[];
        };
      };

      expect(record.requestId).toBe('req_redaction_1');
      expect(record.schemaVersion).toBe('pipeline_event.v1');
      expect(JSON.stringify(record.details)).not.toContain('super-secret-token');
      expect(JSON.stringify(record.details)).toContain('[REDACTED]');
      expect(record.redactionEvidence).toMatchObject({
        redacted: true
      });
      expect(record.redactionEvidence.fieldCount).toBeGreaterThan(0);
      expect(record.redactionEvidence.appliedRules.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('rotates request audit file when max bytes exceeded', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwagent-audit-'));
    try {
      let tick = 0;
      const sink = new AuditFileSink({
        rootDir,
        maxFileBytes: 350,
        now: () => new Date(`2026-06-01T10:00:0${tick++}.000Z`)
      });

      sink.emit({
        requestId: 'req_rotate_1',
        stage: 'orchestrator',
        action: 'execution_run_started',
        timestamp: '2026-06-01T10:00:00.000Z',
        details: {
          stdout: 'A'.repeat(300)
        }
      });

      sink.emit({
        requestId: 'req_rotate_1',
        stage: 'orchestrator',
        action: 'execution_run_retry_attempted',
        timestamp: '2026-06-01T10:00:01.000Z',
        details: {
          stdout: 'B'.repeat(300)
        }
      });

      const auditDir = path.join(rootDir, '.planning', 'logs', 'audit');
      const files = fs.readdirSync(auditDir);
      expect(files).toContain('req_rotate_1.ndjson');
      expect(files.some((name) => name.startsWith('req_rotate_1.') && name.endsWith('.ndjson'))).toBe(true);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
