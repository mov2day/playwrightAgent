import type { ConfluenceQuery } from '../../adapters/confluenceClient';
import type { JiraContextResult } from './jiraContextBuilder';

export interface ConfluenceQueryBuilderOptions {
  maxQueries?: number;
  maxResultsPerQuery?: number;
}

const DEFAULT_MAX_QUERIES = 20;
const DEFAULT_MAX_RESULTS = 5;
const KEYWORD_STOPWORDS = new Set([
  'the',
  'and',
  'with',
  'from',
  'that',
  'this',
  'have',
  'will',
  'into',
  'after',
  'before',
  'where',
  'when',
  'then',
  'were',
  'their',
  'your',
  'about'
]);

function toKeywords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !KEYWORD_STOPWORDS.has(token));

  const deduped = new Set(tokens);
  return [...deduped];
}

function appendQuery(
  target: ConfluenceQuery[],
  seen: Set<string>,
  queryText: string,
  sourceEntity: string,
  priority: number,
  maxResults: number
): void {
  const normalized = queryText.trim();
  if (!normalized) {
    return;
  }

  const key = `${sourceEntity}::${normalized.toLowerCase()}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  target.push({
    queryText: normalized,
    sourceEntity,
    priority,
    maxResults
  });
}

export function buildConfluenceQueriesFromJiraContext(
  context: JiraContextResult,
  options: ConfluenceQueryBuilderOptions = {}
): ConfluenceQuery[] {
  const maxQueries = options.maxQueries ?? DEFAULT_MAX_QUERIES;
  const maxResults = options.maxResultsPerQuery ?? DEFAULT_MAX_RESULTS;
  const queries: ConfluenceQuery[] = [];
  const seen = new Set<string>();

  for (const issue of context.issues) {
    appendQuery(queries, seen, issue.key, `issue:${issue.key}`, 100, maxResults);

    appendQuery(
      queries,
      seen,
      `"${issue.payload.ticket.summary}"`,
      `summary:${issue.key}`,
      90,
      maxResults
    );

    if (issue.payload.epic?.summary) {
      appendQuery(
        queries,
        seen,
        `"${issue.payload.epic.summary}"`,
        `epic:${issue.payload.epic.key}`,
        85,
        maxResults
      );
    }

    const extractedKeywords = toKeywords(
      [
        issue.payload.ticket.summary,
        issue.payload.ticket.description ?? '',
        ...issue.payload.comments.map((comment) => comment.body)
      ].join(' ')
    );

    for (const keyword of extractedKeywords.slice(0, 5)) {
      appendQuery(queries, seen, keyword, `keyword:${issue.key}`, 60, maxResults);
    }

    const componentCandidates = toKeywords(issue.payload.ticket.summary).slice(0, 2);
    for (const componentName of componentCandidates) {
      appendQuery(queries, seen, `component:${componentName}`, `component:${issue.key}`, 55, maxResults);
    }
  }

  for (const linkedPage of context.pages) {
    appendQuery(queries, seen, linkedPage.id, `linked_page:${linkedPage.id}`, 95, maxResults);
    appendQuery(queries, seen, `"${linkedPage.title}"`, `linked_page_title:${linkedPage.id}`, 80, maxResults);
  }

  return queries
    .sort((a, b) => b.priority - a.priority || a.queryText.localeCompare(b.queryText))
    .slice(0, maxQueries);
}
