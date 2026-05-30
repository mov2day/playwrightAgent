import {
  filterAttachmentsForExtraction,
  type JiraAttachmentPolicyOptions
} from '../../adapters/jiraAttachmentPolicy';
import type {
  JiraClient,
  JiraCompleteness,
  JiraTicketGraphPayload
} from '../../adapters/jiraClient';
import {
  traverseJiraGraph,
  type JiraGraphEdge,
  type JiraTraversalLimits
} from '../../adapters/jiraGraphTraversal';

export type JiraContextCompletenessReason = 'timeout' | 'cap_reached' | 'attachment_skipped' | 'fetch_failed';

export interface JiraContextRetryPolicy {
  maxAttempts: number;
  initialBackoffMs: number;
  backoffMultiplier: number;
}

export interface JiraIssueContextRecord {
  key: string;
  payload: JiraTicketGraphPayload;
}

export interface JiraContextBuildInput {
  client: JiraClient;
  ticketId: string;
  requestId: string;
  traversalLimits?: Partial<JiraTraversalLimits>;
  stageBudgetMs?: number;
  fetchTimeoutMs?: number;
  retryPolicy?: Partial<JiraContextRetryPolicy>;
  attachmentPolicy?: JiraAttachmentPolicyOptions;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface JiraContextResult {
  requestId: string;
  rootTicketId: string;
  issues: JiraIssueContextRecord[];
  pages: ReturnType<typeof traverseJiraGraph>['pages'];
  edges: JiraGraphEdge[];
  truncated: ReturnType<typeof traverseJiraGraph>['truncated'];
  completeness: JiraCompleteness;
  metrics: {
    attemptedFetches: number;
    successfulFetches: number;
    retries: number;
    durationMs: number;
  };
}

interface FetchWithRetryResult {
  payload?: JiraTicketGraphPayload;
  attempts: number;
  retries: number;
  timedOut: boolean;
}

const DEFAULT_STAGE_BUDGET_MS = 30_000;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_POLICY: JiraContextRetryPolicy = {
  maxAttempts: 2,
  initialBackoffMs: 200,
  backoffMultiplier: 2
};
const DEFAULT_TRAVERSAL_LIMITS: JiraTraversalLimits = {
  maxIssues: 200,
  maxPages: 100,
  maxEdges: 600
};

function mergeTraversalLimits(limits?: Partial<JiraTraversalLimits>): JiraTraversalLimits {
  return {
    maxIssues: limits?.maxIssues ?? DEFAULT_TRAVERSAL_LIMITS.maxIssues,
    maxPages: limits?.maxPages ?? DEFAULT_TRAVERSAL_LIMITS.maxPages,
    maxEdges: limits?.maxEdges ?? DEFAULT_TRAVERSAL_LIMITS.maxEdges
  };
}

function normalizeRetryPolicy(policy?: Partial<JiraContextRetryPolicy>): JiraContextRetryPolicy {
  const maxAttempts = policy?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts;
  const initialBackoffMs = policy?.initialBackoffMs ?? DEFAULT_RETRY_POLICY.initialBackoffMs;
  const backoffMultiplier = policy?.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier;

  return {
    maxAttempts: Math.max(1, Math.floor(maxAttempts)),
    initialBackoffMs: Math.max(0, Math.floor(initialBackoffMs)),
    backoffMultiplier: Math.max(1, backoffMultiplier)
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /(timed out|timeout|aborted|abort)/i.test(error.message);
}

function relatedIssueKeys(payload: JiraTicketGraphPayload): string[] {
  const next = new Set<string>();

  if (payload.parent?.key) {
    next.add(payload.parent.key);
  }

  if (payload.epic?.key) {
    next.add(payload.epic.key);
  }

  for (const linkedIssue of payload.linkedIssues) {
    if (linkedIssue.key) {
      next.add(linkedIssue.key);
    }
  }

  for (const subtask of payload.subtasks) {
    if (subtask.key) {
      next.add(subtask.key);
    }
  }

  return [...next];
}

function createFallbackPayload(ticketId: string): JiraTicketGraphPayload {
  return {
    ticket: {
      key: ticketId,
      type: 'task',
      summary: 'Unavailable'
    },
    comments: [],
    attachments: [],
    linkedIssues: [],
    linkedPages: [],
    subtasks: [],
    completeness: {
      status: 'partial',
      reasons: ['fetch_failed']
    }
  };
}

function mergeCompletenessReasons(target: Set<string>, payload: JiraTicketGraphPayload): void {
  for (const reason of payload.completeness.reasons) {
    target.add(reason);
  }
}

async function fetchTicketWithRetry(
  input: JiraContextBuildInput,
  ticketId: string,
  deadlineMs: number,
  retryPolicy: JiraContextRetryPolicy,
  fetchTimeoutMs: number,
  now: () => number,
  sleep: (ms: number) => Promise<void>
): Promise<FetchWithRetryResult> {
  let attempts = 0;
  let retries = 0;

  while (attempts < retryPolicy.maxAttempts) {
    const remainingMs = deadlineMs - now();
    if (remainingMs <= 0) {
      return {
        attempts,
        retries,
        timedOut: true
      };
    }

    attempts += 1;

    try {
      const payload = await input.client.fetchTicketGraph({
        ticketId,
        requestId: input.requestId,
        timeoutMs: Math.max(1, Math.min(fetchTimeoutMs, remainingMs))
      });

      return {
        payload,
        attempts,
        retries,
        timedOut: false
      };
    } catch (error) {
      const timedOut = isTimeoutError(error);
      const remainingAfterError = deadlineMs - now();

      if (timedOut || attempts >= retryPolicy.maxAttempts || remainingAfterError <= 0) {
        return {
          attempts,
          retries,
          timedOut: timedOut || remainingAfterError <= 0
        };
      }

      retries += 1;
      const backoffMs = Math.max(
        0,
        Math.floor(retryPolicy.initialBackoffMs * retryPolicy.backoffMultiplier ** (attempts - 1))
      );
      if (backoffMs > 0) {
        await sleep(Math.min(backoffMs, remainingAfterError));
      }
    }
  }

  return {
    attempts,
    retries,
    timedOut: false
  };
}

export async function buildJiraContext(input: JiraContextBuildInput): Promise<JiraContextResult> {
  const now = input.now ?? (() => Date.now());
  const sleep = input.sleep ?? defaultSleep;
  const stageBudgetMs = input.stageBudgetMs ?? DEFAULT_STAGE_BUDGET_MS;
  const fetchTimeoutMs = input.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const retryPolicy = normalizeRetryPolicy(input.retryPolicy);
  const limits = mergeTraversalLimits(input.traversalLimits);

  const startedAtMs = now();
  const deadlineMs = startedAtMs + stageBudgetMs;
  const completenessReasons = new Set<string>();

  const issueGraphByKey: Record<string, JiraTicketGraphPayload> = {};
  const queue: string[] = [input.ticketId];
  const queued = new Set<string>(queue);

  let attemptedFetches = 0;
  let successfulFetches = 0;
  let retries = 0;

  while (queue.length > 0) {
    if (Object.keys(issueGraphByKey).length >= limits.maxIssues) {
      completenessReasons.add('cap_reached');
      break;
    }

    if (now() >= deadlineMs) {
      completenessReasons.add('timeout');
      break;
    }

    const currentTicketId = queue.shift();
    if (!currentTicketId) {
      continue;
    }
    queued.delete(currentTicketId);

    if (issueGraphByKey[currentTicketId]) {
      continue;
    }

    const fetchResult = await fetchTicketWithRetry(
      input,
      currentTicketId,
      deadlineMs,
      retryPolicy,
      fetchTimeoutMs,
      now,
      sleep
    );

    attemptedFetches += fetchResult.attempts;
    retries += fetchResult.retries;

    if (!fetchResult.payload) {
      completenessReasons.add(fetchResult.timedOut ? 'timeout' : 'fetch_failed');
      if (fetchResult.timedOut) {
        break;
      }
      continue;
    }

    successfulFetches += 1;
    issueGraphByKey[currentTicketId] = fetchResult.payload;
    mergeCompletenessReasons(completenessReasons, fetchResult.payload);

    for (const nextTicketId of relatedIssueKeys(fetchResult.payload)) {
      if (issueGraphByKey[nextTicketId] || queued.has(nextTicketId)) {
        continue;
      }

      const projectedIssueCount = Object.keys(issueGraphByKey).length + queue.length;
      if (projectedIssueCount >= limits.maxIssues) {
        completenessReasons.add('cap_reached');
        continue;
      }

      queue.push(nextTicketId);
      queued.add(nextTicketId);
    }
  }

  const root = issueGraphByKey[input.ticketId] ?? createFallbackPayload(input.ticketId);
  mergeCompletenessReasons(completenessReasons, root);

  const traversal = traverseJiraGraph({
    root,
    issueGraphByKey,
    limits
  });

  if (traversal.truncated.issues || traversal.truncated.pages || traversal.truncated.edges) {
    completenessReasons.add('cap_reached');
  }

  const issues: JiraIssueContextRecord[] = traversal.issues.map((ticket) => {
    const payload = issueGraphByKey[ticket.key] ?? createFallbackPayload(ticket.key);
    const filteredAttachments = filterAttachmentsForExtraction(payload.attachments, input.attachmentPolicy);

    if (filteredAttachments.skipped.length > 0) {
      completenessReasons.add('attachment_skipped');
    }

    return {
      key: ticket.key,
      payload: {
        ...payload,
        attachments: filteredAttachments.accepted
      }
    };
  });

  const reasons = [...completenessReasons] as Array<JiraContextCompletenessReason | string>;
  const completeness: JiraCompleteness = {
    status: reasons.length > 0 ? 'partial' : 'full',
    reasons
  };

  return {
    requestId: input.requestId,
    rootTicketId: input.ticketId,
    issues,
    pages: traversal.pages,
    edges: traversal.edges,
    truncated: traversal.truncated,
    completeness,
    metrics: {
      attemptedFetches,
      successfulFetches,
      retries,
      durationMs: Math.max(0, now() - startedAtMs)
    }
  };
}
