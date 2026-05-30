import type { ConfluencePage } from '../../adapters/confluenceClient';
import type { JiraContextResult } from './jiraContextBuilder';

export type ConfluenceRelevanceBucket = 'high' | 'mid' | 'low';

export interface ConfluenceComponentScores {
  lexical: number;
  semantic: number;
  jiraLinkProximity: number;
  freshness: number;
}

export interface ConfluenceRelevanceWeights {
  lexical: number;
  semantic: number;
  jiraLinkProximity: number;
  freshness: number;
  highThreshold: number;
  midThreshold: number;
  freshnessHorizonDays: number;
}

export interface ConfluenceRelevanceSignals {
  issueKeys: string[];
  linkedPageIds: string[];
  jiraTokens: string[];
}

export interface ConfluencePageScore {
  page: ConfluencePage;
  score: number;
  bucket: ConfluenceRelevanceBucket;
  componentScores: ConfluenceComponentScores;
  augmentationOnly: true;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WEIGHTS: ConfluenceRelevanceWeights = {
  lexical: 0.35,
  semantic: 0.3,
  jiraLinkProximity: 0.25,
  freshness: 0.1,
  highThreshold: 0.72,
  midThreshold: 0.4,
  freshnessHorizonDays: 365
};
const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'will',
  'have',
  'been',
  'your',
  'their',
  'were',
  'then',
  'after',
  'before'
]);

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function overlapScore(lhs: string[], rhs: string[]): number {
  if (lhs.length === 0 || rhs.length === 0) {
    return 0;
  }

  const lhsSet = new Set(lhs);
  let matches = 0;
  for (const token of rhs) {
    if (lhsSet.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(1, rhs.length);
}

function semanticScore(pageTokens: string[], jiraTokens: string[]): number {
  if (pageTokens.length === 0 || jiraTokens.length === 0) {
    return 0;
  }

  const pageBigrams = new Set<string>();
  for (let index = 0; index < pageTokens.length - 1; index += 1) {
    const current = pageTokens[index];
    const next = pageTokens[index + 1];
    if (!current || !next) {
      continue;
    }
    pageBigrams.add(`${current}_${next}`);
  }

  const jiraBigrams = new Set<string>();
  for (let index = 0; index < jiraTokens.length - 1; index += 1) {
    const current = jiraTokens[index];
    const next = jiraTokens[index + 1];
    if (!current || !next) {
      continue;
    }
    jiraBigrams.add(`${current}_${next}`);
  }

  if (jiraBigrams.size === 0) {
    return overlapScore(pageTokens, jiraTokens);
  }

  let matches = 0;
  for (const bigram of jiraBigrams) {
    if (pageBigrams.has(bigram)) {
      matches += 1;
    }
  }

  const bigramOverlap = matches / jiraBigrams.size;
  const tokenOverlap = overlapScore(pageTokens, jiraTokens);
  return clamp01((bigramOverlap * 0.7) + (tokenOverlap * 0.3));
}

function linkProximityScore(page: ConfluencePage, signals: ConfluenceRelevanceSignals): number {
  if (signals.linkedPageIds.includes(page.id)) {
    return 1;
  }

  if (!page.linkedJiraKeys || page.linkedJiraKeys.length === 0) {
    return 0;
  }

  const issueKeys = new Set(signals.issueKeys.map((key) => key.toUpperCase()));
  for (const linkedKey of page.linkedJiraKeys) {
    if (issueKeys.has(linkedKey.toUpperCase())) {
      return 0.85;
    }
  }

  return 0;
}

function freshnessScore(page: ConfluencePage, now: Date, horizonDays: number): number {
  if (!page.lastUpdatedAt) {
    return 0.5;
  }

  const parsedDate = new Date(page.lastUpdatedAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return 0.5;
  }

  const ageDays = Math.max(0, (now.getTime() - parsedDate.getTime()) / DAY_MS);
  return clamp01(1 - (ageDays / Math.max(1, horizonDays)));
}

function classifyBucket(score: number, weights: ConfluenceRelevanceWeights): ConfluenceRelevanceBucket {
  if (score >= weights.highThreshold) {
    return 'high';
  }
  if (score >= weights.midThreshold) {
    return 'mid';
  }
  return 'low';
}

export function buildJiraRelevanceSignals(context: JiraContextResult): ConfluenceRelevanceSignals {
  const issueKeys = context.issues.map((issue) => issue.key);
  const linkedPageIds = context.pages.map((page) => page.id);
  const jiraTokens = new Set<string>();

  for (const issue of context.issues) {
    const text = [
      issue.payload.ticket.summary,
      issue.payload.ticket.description ?? '',
      ...issue.payload.comments.map((comment) => comment.body),
      issue.payload.epic?.summary ?? ''
    ].join(' ');

    for (const token of tokenize(text)) {
      jiraTokens.add(token);
    }

    jiraTokens.add(issue.key.toLowerCase());
  }

  return {
    issueKeys,
    linkedPageIds,
    jiraTokens: [...jiraTokens]
  };
}

export function mergeConfluenceWeights(
  overrides: Partial<ConfluenceRelevanceWeights> = {}
): ConfluenceRelevanceWeights {
  return {
    lexical: overrides.lexical ?? DEFAULT_WEIGHTS.lexical,
    semantic: overrides.semantic ?? DEFAULT_WEIGHTS.semantic,
    jiraLinkProximity: overrides.jiraLinkProximity ?? DEFAULT_WEIGHTS.jiraLinkProximity,
    freshness: overrides.freshness ?? DEFAULT_WEIGHTS.freshness,
    highThreshold: overrides.highThreshold ?? DEFAULT_WEIGHTS.highThreshold,
    midThreshold: overrides.midThreshold ?? DEFAULT_WEIGHTS.midThreshold,
    freshnessHorizonDays: overrides.freshnessHorizonDays ?? DEFAULT_WEIGHTS.freshnessHorizonDays
  };
}

export function scoreConfluencePage(
  page: ConfluencePage,
  jiraContext: JiraContextResult,
  weightsInput: Partial<ConfluenceRelevanceWeights> = {},
  now: Date = new Date()
): ConfluencePageScore {
  const weights = mergeConfluenceWeights(weightsInput);
  const signals = buildJiraRelevanceSignals(jiraContext);
  const pageTokens = tokenize([page.title, page.snippet ?? ''].join(' '));

  const componentScores: ConfluenceComponentScores = {
    lexical: overlapScore(pageTokens, signals.jiraTokens),
    semantic: semanticScore(pageTokens, signals.jiraTokens),
    jiraLinkProximity: linkProximityScore(page, signals),
    freshness: freshnessScore(page, now, weights.freshnessHorizonDays)
  };

  const totalWeight =
    weights.lexical + weights.semantic + weights.jiraLinkProximity + weights.freshness;

  const weightedScore = (
    (componentScores.lexical * weights.lexical)
    + (componentScores.semantic * weights.semantic)
    + (componentScores.jiraLinkProximity * weights.jiraLinkProximity)
    + (componentScores.freshness * weights.freshness)
  ) / Math.max(0.0001, totalWeight);

  const score = clamp01(weightedScore);
  const bucket = classifyBucket(score, weights);

  return {
    page,
    score,
    bucket,
    componentScores,
    augmentationOnly: true
  };
}
