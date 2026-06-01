import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDefaultEventSink } from '../../src/adapters/eventSink';
import { handlePlanCommand } from '../../src/participant/handler';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';

describe('security leak canary', () => {
  it('fails closed when canary secrets hit event and audit persistence paths', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwagent-leak-canary-'));
    const requestId = 'req_leak_canary_1';
    const now = () => new Date('2026-06-01T14:00:00.000Z');

    const canaries = [
      'LEAK_CANARY_BEARER_ABC_123',
      'LEAK_CANARY_AUTH_PAIR_DEF_456',
      'LEAK_CANARY_TOKEN_GHI_789',
      'LEAK_CANARY_API_KEY_JKL_000'
    ] as const;

    try {
      const sink = createDefaultEventSink({
        rootDir,
        now
      });
      const orchestrator = new PipelineOrchestrator({
        eventSink: sink,
        now,
        stageEntryGateEvaluator: (stage) => ({
          stage,
          blocked: false,
          fail_closed: false,
          requires_user_decision: false,
          reasons: [],
          availableActions: []
        })
      });

      const planResponse = handlePlanCommand(
        `/plan QA-999 include token=${canaries[2]} and authorization=Bearer ${canaries[0]}`,
        {
          eventSink: sink,
          orchestrator,
          requestIdFactory: () => requestId,
          now
        }
      );
      expect(planResponse.requestId).toBe(requestId);

      const cancelled = orchestrator.transition(
        requestId,
        'cancelled',
        `manual authorization=Bearer ${canaries[1]} and x-api-key: ${canaries[3]}`
      );
      expect(cancelled.ok).toBe(true);

      sink.emit({
        requestId,
        stage: 'orchestrator',
        action: 'security_leak_canary_probe',
        timestamp: now().toISOString(),
        details: {
          probe: `authorization=Bearer ${canaries[0]}`,
          nested: {
            token: `token=${canaries[2]}`,
            api_key: `x-api-key: ${canaries[3]}`
          }
        }
      });

      const auditFilePath = path.join(rootDir, '.planning', 'logs', 'audit', `${requestId}.ndjson`);
      expect(fs.existsSync(auditFilePath)).toBe(true);

      const serialized = fs.readFileSync(auditFilePath, 'utf8');
      expect(serialized).toContain('[REDACTED]');
      for (const canary of canaries) {
        expect(serialized).not.toContain(canary);
      }

      const records = serialized
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as {
          requestId: string;
          schemaVersion: string;
          redactionEvidence: {
            redacted: boolean;
            fieldCount: number;
            appliedRules: string[];
          };
        });

      expect(records.length).toBeGreaterThan(0);
      expect(records.every((record) => record.requestId === requestId)).toBe(true);
      expect(records.every((record) => record.schemaVersion === 'pipeline_event.v1')).toBe(true);
      expect(records.every((record) => record.redactionEvidence.redacted)).toBe(true);
      expect(records.some((record) => record.redactionEvidence.fieldCount > 0)).toBe(true);
      expect(records.some((record) => record.redactionEvidence.appliedRules.length > 0)).toBe(true);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
