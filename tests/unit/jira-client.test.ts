import { describe, expect, it, vi } from 'vitest';

import { LocalToolJiraClient } from '../../src/adapters/jiraClient';

describe('LocalToolJiraClient', () => {
  it('redacts credential-like tokens from tool errors', async () => {
    const runner = vi.fn(async () => ({
      ok: false,
      command: 'jira-tool',
      args: [],
      exitCode: 1,
      stdout: '',
      stderr: 'Authorization=Bearer abc123 secret=my-super-secret token=xyz',
      timedOut: false,
      error: 'Authorization=Bearer abc123 secret=my-super-secret token=xyz'
    }));

    const client = new LocalToolJiraClient({ runner });

    await expect(
      client.fetchTicketGraph({ ticketId: 'QA-123', requestId: 'req_jira_1' })
    ).rejects.toThrow(/\[REDACTED\]/);

    await expect(
      client.fetchTicketGraph({ ticketId: 'QA-123', requestId: 'req_jira_1' })
    ).rejects.not.toThrow(/abc123|my-super-secret|token=xyz/);
  });

  it('parses successful tool payload into normalized graph output', async () => {
    const runner = vi.fn(async () => ({
      ok: true,
      command: 'jira-tool',
      args: [],
      exitCode: 0,
      stdout: JSON.stringify({
        ticket: {
          key: 'QA-123',
          type: 'task',
          summary: 'Checkout can submit order'
        },
        comments: [{ id: 'c1', body: 'Looks good' }],
        attachments: [{ id: 'a1', fileName: 'acceptance.md' }],
        linkedIssues: [{ key: 'QA-130' }],
        linkedPages: [{ id: 'p1', title: 'Checkout spec' }],
        subtasks: [{ key: 'QA-124', type: 'sub-task', summary: 'Add analytics assertion' }],
        completeness: { status: 'full', reasons: [] }
      }),
      stderr: '',
      timedOut: false
    }));

    const client = new LocalToolJiraClient({ runner });
    const payload = await client.fetchTicketGraph({ ticketId: 'QA-123', requestId: 'req_jira_2' });

    expect(payload.ticket.key).toBe('QA-123');
    expect(payload.comments).toHaveLength(1);
    expect(payload.attachments).toHaveLength(1);
    expect(payload.completeness.status).toBe('full');
  });

  it('passes workspace cwd and timeout options to local tool runner', async () => {
    const runner = vi.fn(async () => ({
      ok: true,
      command: 'jira-tool',
      args: [],
      exitCode: 0,
      stdout: JSON.stringify({
        ticket: {
          key: 'QA-456',
          type: 'task',
          summary: 'Uses workspace cwd'
        },
        comments: [],
        attachments: [],
        linkedIssues: [],
        linkedPages: [],
        subtasks: [],
        completeness: { status: 'full', reasons: [] }
      }),
      stderr: '',
      timedOut: false
    }));

    const client = new LocalToolJiraClient({
      cwd: '/workspace/project',
      timeoutMs: 45_000,
      runner
    });

    await client.fetchTicketGraph({ ticketId: 'QA-456', requestId: 'req_jira_3' });

    expect(runner).toHaveBeenCalledWith(
      'node',
      ['scripts/jira-fetch.mjs', '--ticket', 'QA-456', '--request-id', 'req_jira_3'],
      {
        timeoutMs: 45_000,
        cwd: '/workspace/project'
      }
    );
  });

  it('surfaces timeout failures with redacted message', async () => {
    const runner = vi.fn(async () => ({
      ok: false,
      command: 'jira-tool',
      args: [],
      exitCode: null,
      stdout: '',
      stderr: 'Authorization=Bearer abc123',
      timedOut: true,
      error: 'Authorization=Bearer abc123'
    }));

    const client = new LocalToolJiraClient({ runner });

    await expect(
      client.fetchTicketGraph({ ticketId: 'QA-789', requestId: 'req_jira_timeout' })
    ).rejects.toThrow(/timed out/i);
    await expect(
      client.fetchTicketGraph({ ticketId: 'QA-789', requestId: 'req_jira_timeout' })
    ).rejects.not.toThrow(/abc123/);
  });
});
