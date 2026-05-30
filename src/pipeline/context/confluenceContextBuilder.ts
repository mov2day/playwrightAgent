import type {
  ConfluenceClient,
  ConfluencePage,
  ConfluenceQuery
} from '../../adapters/confluenceClient';
import { buildConfluenceQueriesFromJiraContext } from './confluenceQueryBuilder';
import {
  mergeConfluenceWeights,
  scoreConfluencePage,
  type ConfluencePageScore,
  type ConfluenceRelevanceWeights
} from './confluenceRelevance';
import type { JiraContextResult } from './jiraContextBuilder';

export interface ConfluenceContextBuilderOptions {
  client: ConfluenceClient;
  queryLimit?: number;
  maxResultsPerQuery?: number;
  queryTimeoutMs?: number;
  relevanceWeights?: Partial<ConfluenceRelevanceWeights>;
  now?: Date;
}

export interface ConfluenceContextResult {
  requestId: string;
  queries: ConfluenceQuery[];
  bonusCandidates: ConfluencePageScore[];
  visibleOnly: ConfluencePageScore[];
  excludedLow: ConfluencePageScore[];
  highCount: number;
  midCount: number;
  excludedLowCount: number;
  bonusContributionPotential: number;
  augmentationOnly: true;
}

function sanitizeSnippet(snippet: string | undefined, maxLength = 280): string | undefined {
  if (!snippet) {
    return snippet;
  }

  const squashed = snippet.replace(/\s+/g, ' ').trim();
  if (squashed.length <= maxLength) {
    return squashed;
  }
  return `${squashed.slice(0, maxLength)}...`;
}

function sanitizePage(page: ConfluencePage): ConfluencePage {
  return {
    ...page,
    snippet: sanitizeSnippet(page.snippet)
  };
}

export async function buildConfluenceContext(
  jiraContext: JiraContextResult,
  options: ConfluenceContextBuilderOptions
): Promise<ConfluenceContextResult> {
  const queries = buildConfluenceQueriesFromJiraContext(jiraContext, {
    maxQueries: options.queryLimit,
    maxResultsPerQuery: options.maxResultsPerQuery
  });

  const pages = await options.client.searchPages({
    requestId: jiraContext.requestId,
    queries,
    timeoutMs: options.queryTimeoutMs
  });

  const weights = mergeConfluenceWeights(options.relevanceWeights);
  const scoredPages = pages.map((page) => {
    const sanitized = sanitizePage(page);
    return scoreConfluencePage(sanitized, jiraContext, weights, options.now ?? new Date());
  });

  const bonusCandidates = scoredPages.filter((page) => page.bucket === 'high');
  const visibleOnly = scoredPages.filter((page) => page.bucket === 'mid');
  const excludedLow = scoredPages.filter((page) => page.bucket === 'low');

  const bonusContributionPotential = bonusCandidates.reduce((total, candidate) => total + candidate.score, 0);

  return {
    requestId: jiraContext.requestId,
    queries,
    bonusCandidates,
    visibleOnly,
    excludedLow,
    highCount: bonusCandidates.length,
    midCount: visibleOnly.length,
    excludedLowCount: excludedLow.length,
    bonusContributionPotential,
    augmentationOnly: true
  };
}
