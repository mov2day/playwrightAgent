import { describe, expect, it } from 'vitest';

import { traverseJiraGraph } from '../../src/adapters/jiraGraphTraversal';
import type { JiraClient, JiraTicketGraphPayload } from '../../src/adapters/jiraClient';
import { buildJiraContext } from '../../src/pipeline/context/jiraContextBuilder';

describe('traverseJiraGraph', () => {
  it('task deep fetch', () => {
    const root: JiraTicketGraphPayload = {
      ticket: { key: 'QA-100', type: 'task', summary: 'Checkout flow' },
      comments: [],
      attachments: [],
      linkedIssues: [{ key: 'QA-110', relation: 'blocks' }],
      linkedPages: [{ id: 'P-1', title: 'Checkout spec' }],
      subtasks: [{ key: 'QA-101', type: 'sub-task', summary: 'Add assertion' }],
      completeness: { status: 'full', reasons: [] }
    };

    const issueGraphByKey: Record<string, JiraTicketGraphPayload> = {
      'QA-110': {
        ticket: { key: 'QA-110', type: 'task', summary: 'Dependency task' },
        comments: [],
        attachments: [],
        linkedIssues: [{ key: 'QA-120', relation: 'relates_to' }],
        linkedPages: [],
        subtasks: [],
        completeness: { status: 'full', reasons: [] }
      },
      'QA-120': {
        ticket: { key: 'QA-120', type: 'task', summary: 'Further linked issue' },
        comments: [],
        attachments: [],
        linkedIssues: [],
        linkedPages: [],
        subtasks: [],
        completeness: { status: 'full', reasons: [] }
      }
    };

    const result = traverseJiraGraph({ root, issueGraphByKey });

    expect(result.visitedIssues.has('QA-100')).toBe(true);
    expect(result.visitedIssues.has('QA-101')).toBe(true);
    expect(result.visitedIssues.has('QA-110')).toBe(true);
    expect(result.visitedIssues.has('QA-120')).toBe(true);
    expect(result.visitedPages.has('P-1')).toBe(true);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(result.truncated).toEqual({ issues: false, pages: false, edges: false });
  });

  it('subtask parent fetch', () => {
    const root: JiraTicketGraphPayload = {
      ticket: { key: 'QA-200', type: 'sub-task', summary: 'Sub-task work item' },
      comments: [],
      attachments: [],
      linkedIssues: [],
      linkedPages: [],
      parent: { key: 'QA-199', type: 'task', summary: 'Parent task' },
      subtasks: [],
      completeness: { status: 'full', reasons: [] }
    };

    const result = traverseJiraGraph({ root });

    expect(result.visitedIssues.has('QA-200')).toBe(true);
    expect(result.visitedIssues.has('QA-199')).toBe(true);
    expect(result.edges.some((edge) => edge.relation === 'subtask_parent_required')).toBe(true);
  });

  it('always fetch epic', () => {
    const root: JiraTicketGraphPayload = {
      ticket: { key: 'QA-300', type: 'task', summary: 'Ticket with epic' },
      comments: [],
      attachments: [],
      linkedIssues: [],
      linkedPages: [],
      epic: { key: 'QA-EPIC-1', type: 'epic', summary: 'Payment Epic' },
      subtasks: [],
      completeness: { status: 'full', reasons: [] }
    };

    const result = traverseJiraGraph({ root });

    expect(result.visitedIssues.has('QA-EPIC-1')).toBe(true);
    expect(result.edges.some((edge) => edge.relation === 'epic')).toBe(true);
  });

  it('sets truncation flags when issue cap is reached', () => {
    const root: JiraTicketGraphPayload = {
      ticket: { key: 'QA-400', type: 'task', summary: 'Cap test' },
      comments: [],
      attachments: [],
      linkedIssues: [
        { key: 'QA-401' },
        { key: 'QA-402' }
      ],
      linkedPages: [],
      subtasks: [],
      completeness: { status: 'full', reasons: [] }
    };

    const result = traverseJiraGraph({
      root,
      limits: {
        maxIssues: 2
      }
    });

    expect(result.truncated.issues).toBe(true);
    expect(result.truncated.pages).toBe(false);
    expect(result.truncated.edges).toBe(false);
  });
});

describe('buildJiraContext', () => {
  it('sets partial completeness when cap is reached', async () => {
    const fallbackPayload: JiraTicketGraphPayload = {
      ticket: { key: 'QA-500', type: 'task', summary: 'Cap root' },
      comments: [],
      attachments: [],
      linkedIssues: [],
      linkedPages: [],
      subtasks: [],
      completeness: { status: 'full', reasons: [] }
    };

    const payloads: Record<string, JiraTicketGraphPayload> = {
      'QA-500': {
        ticket: { key: 'QA-500', type: 'task', summary: 'Cap root' },
        comments: [],
        attachments: [],
        linkedIssues: [{ key: 'QA-501' }, { key: 'QA-502' }],
        linkedPages: [],
        subtasks: [],
        completeness: { status: 'full', reasons: [] }
      },
      'QA-501': {
        ticket: { key: 'QA-501', type: 'task', summary: 'Linked issue' },
        comments: [],
        attachments: [],
        linkedIssues: [],
        linkedPages: [],
        subtasks: [],
        completeness: { status: 'full', reasons: [] }
      }
    };

    const client: JiraClient = {
      fetchTicketGraph: async ({ ticketId }) => payloads[ticketId] ?? fallbackPayload
    };

    const context = await buildJiraContext({
      client,
      ticketId: 'QA-500',
      requestId: 'req-cap-1',
      traversalLimits: {
        maxIssues: 2
      },
      retryPolicy: {
        maxAttempts: 1
      }
    });

    expect(context.completeness.status).toBe('partial');
    expect(context.completeness.reasons).toContain('cap_reached');
  });

  it('sets partial completeness when timeout happens', async () => {
    const client: JiraClient = {
      fetchTicketGraph: async () => {
        throw new Error('timed out while fetching Jira context');
      }
    };

    const context = await buildJiraContext({
      client,
      ticketId: 'QA-600',
      requestId: 'req-timeout-1',
      stageBudgetMs: 25,
      retryPolicy: {
        maxAttempts: 1
      },
      sleep: async () => undefined
    });

    expect(context.completeness.status).toBe('partial');
    expect(context.completeness.reasons).toContain('timeout');
  });
});
