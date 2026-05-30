import { describe, expect, it } from 'vitest';

import type { ConfluenceClient, ConfluencePage } from '../../src/adapters/confluenceClient';
import { buildConfluenceContext } from '../../src/pipeline/context/confluenceContextBuilder';
import { scoreConfluencePage } from '../../src/pipeline/context/confluenceRelevance';
import type { JiraContextResult } from '../../src/pipeline/context/jiraContextBuilder';

function createJiraContextFixture(): JiraContextResult {
  return {
    requestId: 'req_conf_2',
    rootTicketId: 'QA-555',
    issues: [
      {
        key: 'QA-555',
        payload: {
          ticket: {
            key: 'QA-555',
            type: 'task',
            summary: 'Checkout payment confirmation flow',
            description: 'Validate order confirmation page and payment completion.'
          },
          comments: [
            {
              id: 'c1',
              body: 'Acceptance criteria mentions checkout confirmation and order summary.'
            }
          ],
          attachments: [],
          linkedIssues: [],
          linkedPages: [{ id: 'CP-1', title: 'Checkout Product Spec' }],
          subtasks: [],
          completeness: { status: 'full', reasons: [] }
        }
      }
    ],
    pages: [{ id: 'CP-1', title: 'Checkout Product Spec' }],
    edges: [],
    truncated: { issues: false, pages: false, edges: false },
    completeness: { status: 'full', reasons: [] },
    metrics: { attemptedFetches: 1, successfulFetches: 1, retries: 0, durationMs: 10 }
  };
}

describe('scoreConfluencePage', () => {
  it('high bonus', () => {
    const jiraContext = createJiraContextFixture();
    const page: ConfluencePage = {
      id: 'CP-1',
      title: 'QA-555 checkout payment confirmation specification',
      snippet: 'Checkout payment confirmation flow with order summary acceptance criteria',
      lastUpdatedAt: '2026-05-20T00:00:00.000Z',
      linkedJiraKeys: ['QA-555']
    };

    const scored = scoreConfluencePage(page, jiraContext, {
      highThreshold: 0.5,
      midThreshold: 0.3
    });

    expect(scored.bucket).toBe('high');
    expect(scored.score).toBeGreaterThanOrEqual(0.5);
    expect(scored.augmentationOnly).toBe(true);
    expect(scored.componentScores).toHaveProperty('lexical');
    expect(scored.componentScores).toHaveProperty('semantic');
    expect(scored.componentScores).toHaveProperty('jiraLinkProximity');
    expect(scored.componentScores).toHaveProperty('freshness');
  });

  it('mid neutral', () => {
    const jiraContext = createJiraContextFixture();
    const page: ConfluencePage = {
      id: 'CP-2',
      title: 'Checkout notes',
      snippet: 'Reference notes for order confirmation behavior.',
      lastUpdatedAt: '2025-12-01T00:00:00.000Z',
      linkedJiraKeys: ['QA-555']
    };

    const scored = scoreConfluencePage(page, jiraContext, {
      highThreshold: 0.85,
      midThreshold: 0.3
    });

    expect(scored.bucket).toBe('mid');
    expect(scored.score).toBeGreaterThanOrEqual(0.3);
    expect(scored.score).toBeLessThan(0.85);
  });

  it('low excluded', () => {
    const jiraContext = createJiraContextFixture();
    const page: ConfluencePage = {
      id: 'CP-3',
      title: 'Legacy deployment checklist',
      snippet: 'Infrastructure runbook for unrelated service',
      lastUpdatedAt: '2022-01-01T00:00:00.000Z'
    };

    const scored = scoreConfluencePage(page, jiraContext, {
      highThreshold: 0.75,
      midThreshold: 0.2
    });

    expect(scored.bucket).toBe('low');
    expect(scored.score).toBeLessThan(0.2);
  });

  it('reduces score as content gets older', () => {
    const jiraContext = createJiraContextFixture();
    const basePage: ConfluencePage = {
      id: 'CP-4',
      title: 'Checkout payment confirmation design',
      snippet: 'Design details for confirmation flow and summary section',
      linkedJiraKeys: ['QA-555']
    };

    const fresh = scoreConfluencePage(
      {
        ...basePage,
        lastUpdatedAt: '2026-05-25T00:00:00.000Z'
      },
      jiraContext,
      {},
      new Date('2026-05-30T00:00:00.000Z')
    );

    const stale = scoreConfluencePage(
      {
        ...basePage,
        lastUpdatedAt: '2024-01-01T00:00:00.000Z'
      },
      jiraContext,
      {},
      new Date('2026-05-30T00:00:00.000Z')
    );

    expect(stale.score).toBeLessThan(fresh.score);
  });
});

describe('buildConfluenceContext', () => {
  it('separates bonus candidates and visible-only pages while excluding low pages from scoring contributions', async () => {
    const jiraContext = createJiraContextFixture();
    const client: ConfluenceClient = {
      searchPages: async () => [
        {
          id: 'CP-1',
          title: 'QA-555 checkout payment confirmation specification',
          snippet: 'Checkout flow acceptance criteria and linked Jira details',
          linkedJiraKeys: ['QA-555'],
          lastUpdatedAt: '2026-05-25T00:00:00.000Z'
        },
        {
          id: 'CP-2',
          title: 'Checkout notes',
          snippet: 'Reference notes for order confirmation behavior.',
          lastUpdatedAt: '2025-12-01T00:00:00.000Z',
          linkedJiraKeys: ['QA-555']
        },
        {
          id: 'CP-3',
          title: 'Legacy deployment checklist',
          snippet: 'Infrastructure runbook for unrelated service',
          lastUpdatedAt: '2022-01-01T00:00:00.000Z'
        }
      ]
    };

    const context = await buildConfluenceContext(jiraContext, {
      client,
      now: new Date('2026-05-30T00:00:00.000Z'),
      relevanceWeights: {
        highThreshold: 0.5,
        midThreshold: 0.2
      }
    });

    expect(context.bonusCandidates.length).toBeGreaterThan(0);
    expect(context.visibleOnly.length).toBeGreaterThan(0);
    expect(context.highCount).toBe(context.bonusCandidates.length);
    expect(context.midCount).toBe(context.visibleOnly.length);
    expect(context.excludedLowCount).toBe(1);
    expect(context.bonusCandidates.some((candidate) => candidate.page.id === 'CP-3')).toBe(false);
    expect(context.scoringContribution.some((candidate) => candidate.page.id === 'CP-3')).toBe(false);
    expect(context.bonusContributionPotential).toBeGreaterThan(0);
  });
});
