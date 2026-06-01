import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LocalToolCommandResult } from '../../src/adapters/localToolRunner';
import { createDefaultEventSink } from '../../src/adapters/eventSink';
import { handleExecutionGuardrailDecision, handlePlanCommand, handlePreviewApproveAll } from '../../src/participant/handler';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';

function makeCommandResult(overrides: Partial<LocalToolCommandResult> = {}): LocalToolCommandResult {
  return {
    ok: false,
    command: 'npx',
    args: ['playwright', 'test', '--reporter=json'],
    exitCode: 1,
    stdout: '',
    stderr: 'expect(received).toBeVisible() failed',
    timedOut: false,
    error: 'expect(received).toBeVisible() failed',
    ...overrides
  };
}

describe('audit persistence request correlation', () => {
  it('persists schema-versioned ai_interaction and gate_decision records with request correlation fields', async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwagent-audit-correlation-'));
    try {
      const now = () => new Date('2026-06-01T12:00:00.000Z');
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
          manifest_hash: 'audit-correlation'
        })
      });

      const response = handlePlanCommand('/plan QA-100 validate checkout and retries', {
        eventSink: sink,
        orchestrator,
        requestIdFactory: () => 'req_audit_corr_1',
        now
      });

      expect(response.requestId).toBe('req_audit_corr_1');
      expect(orchestrator.handleQuickAction(response.requestId, 'approve').ok).toBe(true);
      expect(orchestrator.handleQuickAction(response.requestId, 'continue').ok).toBe(true);
      expect(orchestrator.handleQuickAction(response.requestId, 'approve').ok).toBe(true);
      expect(handlePreviewApproveAll(response.requestId, 'preview.v1', {
        orchestrator,
        now
      }).ok).toBe(true);
      expect(orchestrator.handleQuickAction(response.requestId, 'continue').ok).toBe(true);
      expect(orchestrator.transition(response.requestId, 'completed', 'test_bootstrap').ok).toBe(true);

      const escalated = await orchestrator.executeScopedRun(response.requestId, {
        generatedOrUpdatedTargets: ['tests/e2e/checkout.spec.ts'],
        commandRunner: async (command, args) => makeCommandResult({
          command,
          args
        }),
        applyScopedAutoFix: async () => ({
          ok: false,
          summary: 'Retry fix failed.'
        })
      });
      expect(escalated.ok).toBe(false);
      expect(escalated.errorCode).toBe('GUARDRAIL_ESCALATION_REQUIRED');

      const resumed = await handleExecutionGuardrailDecision(
        response.requestId,
        'continue',
        'Manual selector fix applied.',
        {
          orchestrator,
          executionRunOptions: {
            commandRunner: async (command, args) => makeCommandResult({
              ok: true,
              command,
              args,
              exitCode: 0,
              stdout: '{"status":"passed"}',
              stderr: '',
              error: undefined
            })
          }
        }
      );

      expect(resumed.ok).toBe(true);

      const auditFilePath = path.join(rootDir, '.planning', 'logs', 'audit', 'req_audit_corr_1.ndjson');
      expect(fs.existsSync(auditFilePath)).toBe(true);

      const records = fs.readFileSync(auditFilePath, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as {
          requestId: string;
          timestamp: string;
          stage: string;
          action: string;
          schemaVersion: string;
          interactionType?: string;
          decisionAction?: string;
          decisionComment?: string;
        });

      expect(records.every((record) => record.requestId === 'req_audit_corr_1')).toBe(true);
      expect(records.every((record) => typeof record.timestamp === 'string' && record.timestamp.length > 0)).toBe(true);
      expect(records.every((record) => typeof record.stage === 'string' && record.stage.length > 0)).toBe(true);
      expect(records.every((record) => typeof record.action === 'string' && record.action.length > 0)).toBe(true);
      expect(records.every((record) => record.schemaVersion === 'pipeline_event.v1')).toBe(true);
      expect(records.some((record) => record.interactionType === 'ai_interaction')).toBe(true);
      expect(records.some((record) => record.interactionType === 'gate_decision')).toBe(true);
      expect(records.some((record) => record.action === 'guardrail_decision_recorded'
        && record.decisionAction === 'continue'
        && record.decisionComment === 'Manual selector fix applied.')).toBe(true);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
