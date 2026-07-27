import { describe, expect, it, vi } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import type { LocalToolCommandResult } from '../../src/adapters/localToolRunner';
import { LocalToolConfluenceClient } from '../../src/adapters/confluenceClient';
import { LocalToolJiraClient } from '../../src/adapters/jiraClient';
import { handlePlanCommand } from '../../src/participant/handler';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator';

function okResult(stdout: string): LocalToolCommandResult {
  return {
    ok: true,
    command: 'node',
    args: [],
    exitCode: 0,
    stdout,
    stderr: '',
    timedOut: false
  };
}

describe('security boundary local-tool only', () => {
  it('keeps local-tool arguments scoped to request data and excludes credential env values', async () => {
    const jiraEnvSecret = 'JIRA_ENV_CANARY_SECRET_1';
    const confluenceEnvSecret = 'CONF_ENV_CANARY_SECRET_2';
    process.env.JIRA_API_TOKEN = jiraEnvSecret;
    process.env.CONFLUENCE_API_TOKEN = confluenceEnvSecret;

    const jiraRunner = vi.fn(async (command: string, args: string[]) => {
      expect(command).toBe('node');
      expect(args).toEqual([
        'scripts/jira-fetch.mjs',
        '--ticket',
        'QA-610',
        '--request-id',
        'req_boundary_1'
      ]);
      expect(args.join(' ')).not.toContain(jiraEnvSecret);
      expect(args.join(' ')).not.toContain(confluenceEnvSecret);

      return okResult(JSON.stringify({
        ticket: {
          key: 'QA-610',
          type: 'task',
          summary: 'Boundary fixture'
        },
        comments: [],
        attachments: [],
        linkedIssues: [],
        linkedPages: [],
        subtasks: [],
        completeness: { status: 'full', reasons: [] }
      }));
    });

    const confluenceRunner = vi.fn(async (command: string, args: string[]) => {
      expect(command).toBe('node');
      expect(args).toEqual([
        'scripts/confluence-search.mjs',
        '--request-id',
        'req_boundary_1',
        '--queries-json',
        '[{"queryText":"QA-610 checkout coverage","sourceEntity":"jira:QA-610","priority":10,"maxResults":3}]'
      ]);
      expect(args.join(' ')).not.toContain(jiraEnvSecret);
      expect(args.join(' ')).not.toContain(confluenceEnvSecret);

      return okResult('[]');
    });

    const jiraClient = new LocalToolJiraClient({
      runner: jiraRunner
    });
    const confluenceClient = new LocalToolConfluenceClient({
      runner: confluenceRunner
    });

    await jiraClient.fetchTicketGraph({
      ticketId: 'QA-610',
      requestId: 'req_boundary_1'
    });

    await confluenceClient.searchPages({
      requestId: 'req_boundary_1',
      queries: [{
        queryText: 'QA-610 checkout coverage',
        sourceEntity: 'jira:QA-610',
        priority: 10,
        maxResults: 3
      }]
    });
  });

  it('redacts credential-like values from local-tool failure surfaces', async () => {
    const jiraSecret = 'LEAK_CANARY_JIRA_SECRET_ABC';
    const confluenceSecret = 'LEAK_CANARY_CONF_SECRET_DEF';

    const jiraClient = new LocalToolJiraClient({
      runner: async () => ({
        ok: false,
        command: 'node',
        args: ['scripts/jira-fetch.mjs'],
        exitCode: 1,
        stdout: '',
        stderr: `authorization=Bearer ${jiraSecret}`,
        timedOut: false,
        error: `token=${jiraSecret}`
      })
    });

    const confluenceClient = new LocalToolConfluenceClient({
      runner: async () => ({
        ok: false,
        command: 'node',
        args: ['scripts/confluence-search.mjs'],
        exitCode: 1,
        stdout: '',
        stderr: `x-api-key: ${confluenceSecret}`,
        timedOut: false,
        error: `secret=${confluenceSecret}`
      })
    });

    await expect(
      jiraClient.fetchTicketGraph({
        ticketId: 'QA-611',
        requestId: 'req_boundary_2'
      })
    ).rejects.toThrow(/\[REDACTED\]/);
    await expect(
      jiraClient.fetchTicketGraph({
        ticketId: 'QA-611',
        requestId: 'req_boundary_2'
      })
    ).rejects.not.toThrow(jiraSecret);

    await expect(
      confluenceClient.searchPages({
        requestId: 'req_boundary_2',
        queries: []
      })
    ).rejects.toThrow(/\[REDACTED\]/);
    await expect(
      confluenceClient.searchPages({
        requestId: 'req_boundary_2',
        queries: []
      })
    ).rejects.not.toThrow(confluenceSecret);
  });

  it('propagates workspace cwd to Jira and Confluence local tooling', async () => {
    const jiraRunner = vi.fn(async () => okResult(JSON.stringify({
      ticket: {
        key: 'QA-613',
        type: 'task',
        summary: 'Workspace cwd propagation'
      },
      comments: [],
      attachments: [],
      linkedIssues: [],
      linkedPages: [],
      subtasks: [],
      completeness: { status: 'full', reasons: [] }
    })));
    const confluenceRunner = vi.fn(async () => okResult('[]'));

    const jiraClient = new LocalToolJiraClient({
      cwd: '/workspace/project',
      runner: jiraRunner
    });
    const confluenceClient = new LocalToolConfluenceClient({
      cwd: '/workspace/project',
      runner: confluenceRunner
    });

    await jiraClient.fetchTicketGraph({
      ticketId: 'QA-613',
      requestId: 'req_boundary_3'
    });
    await confluenceClient.searchPages({
      requestId: 'req_boundary_3',
      queries: [{
        queryText: 'QA-613 workspace cwd',
        sourceEntity: 'jira:QA-613',
        priority: 5,
        maxResults: 2
      }]
    });

    expect(jiraRunner).toHaveBeenCalledWith(
      'node',
      ['scripts/jira-fetch.mjs', '--ticket', 'QA-613', '--request-id', 'req_boundary_3'],
      expect.objectContaining({
        cwd: '/workspace/project'
      })
    );
    expect(confluenceRunner).toHaveBeenCalledWith(
      'node',
      [
        'scripts/confluence-search.mjs',
        '--request-id',
        'req_boundary_3',
        '--queries-json',
        '[{"queryText":"QA-613 workspace cwd","sourceEntity":"jira:QA-613","priority":5,"maxResults":2}]'
      ],
      expect.objectContaining({
        cwd: '/workspace/project'
      })
    );
  });

  it('does not serialize raw secret values in participant/orchestrator event details', () => {
    const canary = 'LEAK_CANARY_EVENT_DETAILS_789';
    const sink = new InMemoryEventSink();
    const now = () => new Date('2026-06-01T13:30:00.000Z');
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

    const response = handlePlanCommand(`/plan QA-612 include token=${canary}`, {
      eventSink: sink,
      orchestrator,
      requestIdFactory: () => 'req_boundary_events_1',
      now
    });

    const transition = orchestrator.transition(
      response.requestId,
      'cancelled',
      `manual authorization=Bearer ${canary}`
    );
    expect(transition.ok).toBe(true);

    const serializedDetails = sink.getEvents()
      .map((event) => JSON.stringify(event.details ?? {}))
      .join('\n');

    expect(serializedDetails).not.toContain(canary);
    expect(serializedDetails).toContain('[REDACTED]');
  });
});
