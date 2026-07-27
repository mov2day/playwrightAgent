import { describe, expect, it, vi } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import { createParticipantRequestHandler, getRequestSnapshot, type PlanCommandResponse } from '../../src/participant/handler';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';
import { buildPlanReviewBundle } from '../../src/pipeline/planning/scenarioGrouping';
import { buildScenarioPlan } from '../../src/pipeline/planning/scenarioMapper';

function makeOrchestrator(sink: InMemoryEventSink) {
  return new PipelineOrchestrator({
    eventSink: sink,
    now: () => new Date('2026-06-02T09:00:00.000Z'),
    stageEntryGateEvaluator: (stage) => ({
      stage,
      blocked: false,
      fail_closed: false,
      requires_user_decision: false,
      reasons: [],
      manifest_hash: 'runtime-ticket-context'
    })
  });
}

describe('runtime ticket context flow', () => {
  it('fails closed for ticket mode when Jira tooling is unavailable', async () => {
    const sink = new InMemoryEventSink();
    const orchestrator = makeOrchestrator(sink);
    const handler = createParticipantRequestHandler({
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_runtime_block_1',
      now: () => new Date('2026-06-02T09:00:00.000Z')
    });

    const response = await handler('/plan QA-900 checkout confirmation') as PlanCommandResponse;

    expect(response.mode).toBe('ticket');
    expect(response.decisionGate).toBe('reject');
    expect(response.state).toBe('cancelled');
    expect(response.message).toContain('Jira local tooling is not configured');
    expect(response.planScenarios).toBeUndefined();
    expect(response.explainability.componentScores.jira).toBe(0);
    expect(response.explainability.componentScores.confluence).toBe(0);
    expect(response.warnings).toContain('jira: local tooling client not configured; ticket mode is blocked.');
  });

  it('builds ticket plan from Jira acceptance criteria and prioritized user context', async () => {
    const sink = new InMemoryEventSink();
    const orchestrator = makeOrchestrator(sink);
    const handler = createParticipantRequestHandler({
      eventSink: sink,
      orchestrator,
      repoRootDir: '/Users/muthu/Documents/GitHub/playwrightAgent',
      requestIdFactory: () => 'req_runtime_ticket_2',
      now: () => new Date('2026-06-02T09:00:00.000Z'),
      jiraClient: {
        fetchTicketGraph: async () => ({
          ticket: {
            key: 'QA-901',
            type: 'task',
            summary: 'Checkout order confirmation',
            description: [
              'Customer completes checkout after valid payment.',
              'Acceptance Criteria:',
              '1. When payment succeeds, then order confirmation page is shown.',
              '2. When payment fails, then checkout keeps user on page with error message.'
            ].join('\n')
          },
          comments: [
            { id: 'c1', body: 'This comment should not drive confidence heavily.' }
          ],
          attachments: [],
          linkedIssues: [],
          linkedPages: [],
          subtasks: [
            { key: 'QA-902', type: 'sub-task', summary: 'Persist order number in confirmation UI' }
          ],
          completeness: { status: 'full', reasons: [] }
        })
      }
    });

    const response = await handler('/plan QA-901 also cover mobile checkout handoff') as PlanCommandResponse;

    expect(response.mode).toBe('ticket');
    expect(response.planScenarios?.length).toBeGreaterThan(1);
    expect(response.planScenarios?.some((scenario) => scenario.assertionIntentSummary.includes('mobile checkout handoff'))).toBe(true);
    expect(response.planScenarios?.some((scenario) => scenario.assertionIntentSummary.includes('payment succeeds'))).toBe(true);
    expect(response.planScenarios?.some((scenario) => scenario.sourceEvidenceIds.includes('QA-901'))).toBe(true);
    expect(response.planScenarios?.every((scenario) => !scenario.scenarioName.includes('Validate QA-901 acceptance flow'))).toBe(true);
    expect(response.explainability.componentScores.jira).toBeGreaterThan(60);
    expect(response.explainability.componentScores.confluence).toBe(0);
  });

  it('routes non-command chat follow-up into active free-text revision flow', async () => {
    const sink = new InMemoryEventSink();
    const orchestrator = makeOrchestrator(sink);
    const handler = createParticipantRequestHandler({
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_runtime_free_text_3',
      now: () => new Date('2026-06-02T09:00:00.000Z'),
      confidenceInputFactory: () => ({
        componentScores: {
          repo: 75,
          jira: 75,
          confluence: 0,
          user_context: 75
        },
        evidence: [],
        reasons: []
      }),
      planBundleFactory: () => {
        const scenarios = buildScenarioPlan([
          {
            requirementId: 'PLAN-05',
            acceptanceCriteriaIds: ['AC-5'],
            scenarioName: 'Authentication stable login',
            scope: 'Auth',
            assertionIntentSummary: 'Valid credentials reach dashboard.',
            functionality: 'Authentication',
            riskLevel: 'low',
            riskReason: 'Stable path',
            sourceEvidenceIds: ['jira:QA-602']
          }
        ]);

        return buildPlanReviewBundle(scenarios);
      }
    });

    const stream = { markdown: vi.fn() };
    const firstResult = await handler(
      { prompt: '/plan QA-602 auth and checkout' },
      { history: [] },
      stream,
      {}
    ) as { metadata: { playwrightAgent: { requestId: string } } };

    await handler(
      { prompt: 'bug: scn_plan_05_1 fails intermittently on selector lookup' },
      {
        history: [{ result: firstResult }]
      },
      stream,
      {}
    );

    const snapshot = getRequestSnapshot('req_runtime_free_text_3');
    const reviewSnapshot = orchestrator.getReviewSnapshot('req_runtime_free_text_3');

    expect(snapshot?.userContextParts.at(-1)).toContain('selector lookup');
    expect(reviewSnapshot?.regenerationScenarioIds).toContain('scn_plan_05_1');
    expect(stream.markdown).toHaveBeenCalled();
  });
});
