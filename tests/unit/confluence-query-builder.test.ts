import { describe, expect, it } from 'vitest';

import { buildConfluenceQueriesFromJiraContext } from '../../src/pipeline/context/confluenceQueryBuilder';
import type { JiraContextResult } from '../../src/pipeline/context/jiraContextBuilder';

function createJiraContextFixture(): JiraContextResult {
  return {
    requestId: 'req_conf_1',
    rootTicketId: 'QA-123',
    issues: [
      {
        key: 'QA-123',
        payload: {
          ticket: {
            key: 'QA-123',
            type: 'task',
            summary: 'Checkout payment confirmation',
            description: 'Verify checkout confirmation and receipt rendering.'
          },
          comments: [
            {
              id: 'c1',
              body: 'Acceptance: checkout shows confirmation and order number.'
            }
          ],
          attachments: [],
          linkedIssues: [],
          linkedPages: [{ id: 'P-1', title: 'Checkout Acceptance Spec' }],
          epic: {
            key: 'QA-EPIC-2',
            type: 'epic',
            summary: 'Checkout Improvements'
          },
          subtasks: [],
          completeness: {
            status: 'full',
            reasons: []
          }
        }
      }
    ],
    pages: [{ id: 'P-1', title: 'Checkout Acceptance Spec' }],
    edges: [],
    truncated: {
      issues: false,
      pages: false,
      edges: false
    },
    completeness: {
      status: 'full',
      reasons: []
    },
    metrics: {
      attemptedFetches: 1,
      successfulFetches: 1,
      retries: 0,
      durationMs: 20
    }
  };
}

describe('buildConfluenceQueriesFromJiraContext', () => {
  it('emits deterministic query objects with required fields', () => {
    const context = createJiraContextFixture();
    const queries = buildConfluenceQueriesFromJiraContext(context);

    expect(queries.length).toBeGreaterThan(0);
    expect(queries[0]).toHaveProperty('queryText');
    expect(queries[0]).toHaveProperty('priority');
    expect(queries[0]).toHaveProperty('sourceEntity');
    expect(queries[0]).toHaveProperty('maxResults');
  });

  it('includes Jira issue key tokens in generated queries', () => {
    const context = createJiraContextFixture();
    const queries = buildConfluenceQueriesFromJiraContext(context);

    expect(queries.some((query) => query.queryText.includes('QA-123'))).toBe(true);
  });
});
