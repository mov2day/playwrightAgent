import type {
  JiraLinkedIssue,
  JiraLinkedPage,
  JiraTicketDetails,
  JiraTicketGraphPayload
} from './jiraClient';

export interface JiraGraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface JiraTraversalLimits {
  maxIssues: number;
  maxPages: number;
  maxEdges: number;
}

export interface JiraPageGraphNode {
  page: JiraLinkedPage;
  linkedIssues?: JiraLinkedIssue[];
  linkedPages?: JiraLinkedPage[];
}

export interface JiraTraversalInput {
  root: JiraTicketGraphPayload;
  limits?: Partial<JiraTraversalLimits>;
  issueGraphByKey?: Record<string, JiraTicketGraphPayload>;
  pageGraphById?: Record<string, JiraPageGraphNode>;
}

export interface JiraTraversalResult {
  issues: JiraTicketDetails[];
  pages: JiraLinkedPage[];
  edges: JiraGraphEdge[];
  visitedIssues: Set<string>;
  visitedPages: Set<string>;
  truncated: {
    issues: boolean;
    pages: boolean;
    edges: boolean;
  };
}

const DEFAULT_LIMITS: JiraTraversalLimits = {
  maxIssues: 200,
  maxPages: 100,
  maxEdges: 600
};

function mergeLimits(limits?: Partial<JiraTraversalLimits>): JiraTraversalLimits {
  return {
    maxIssues: limits?.maxIssues ?? DEFAULT_LIMITS.maxIssues,
    maxPages: limits?.maxPages ?? DEFAULT_LIMITS.maxPages,
    maxEdges: limits?.maxEdges ?? DEFAULT_LIMITS.maxEdges
  };
}

function asTicketFromLinkedIssue(linkedIssue: JiraLinkedIssue): JiraTicketDetails {
  return {
    key: linkedIssue.key,
    type: linkedIssue.type ?? 'task',
    summary: linkedIssue.summary ?? linkedIssue.key,
    status: linkedIssue.status
  };
}

function addIssue(
  issue: JiraTicketDetails,
  issueMap: Map<string, JiraTicketDetails>,
  visitedIssues: Set<string>,
  limits: JiraTraversalLimits,
  truncated: JiraTraversalResult['truncated']
): boolean {
  if (visitedIssues.has(issue.key)) {
    return false;
  }

  if (visitedIssues.size >= limits.maxIssues) {
    truncated.issues = true;
    return false;
  }

  visitedIssues.add(issue.key);
  issueMap.set(issue.key, issue);
  return true;
}

function addPage(
  page: JiraLinkedPage,
  pageMap: Map<string, JiraLinkedPage>,
  visitedPages: Set<string>,
  limits: JiraTraversalLimits,
  truncated: JiraTraversalResult['truncated']
): boolean {
  if (visitedPages.has(page.id)) {
    return false;
  }

  if (visitedPages.size >= limits.maxPages) {
    truncated.pages = true;
    return false;
  }

  visitedPages.add(page.id);
  pageMap.set(page.id, page);
  return true;
}

function addEdge(
  edge: JiraGraphEdge,
  edges: JiraGraphEdge[],
  limits: JiraTraversalLimits,
  truncated: JiraTraversalResult['truncated']
): void {
  if (edges.length >= limits.maxEdges) {
    truncated.edges = true;
    return;
  }

  edges.push(edge);
}

export function traverseJiraGraph(input: JiraTraversalInput): JiraTraversalResult {
  const limits = mergeLimits(input.limits);
  const issueGraphByKey = {
    [input.root.ticket.key]: input.root,
    ...(input.issueGraphByKey ?? {})
  };

  const issueMap = new Map<string, JiraTicketDetails>();
  const pageMap = new Map<string, JiraLinkedPage>();
  const edges: JiraGraphEdge[] = [];
  const visitedIssues = new Set<string>();
  const visitedPages = new Set<string>();
  const truncated = {
    issues: false,
    pages: false,
    edges: false
  };

  const issueQueue: string[] = [];
  const pageQueue: string[] = [];

  const enqueueIssue = (issue: JiraTicketDetails, from?: string, relation?: string) => {
    const added = addIssue(issue, issueMap, visitedIssues, limits, truncated);
    if (from && relation) {
      addEdge({ from, to: issue.key, relation }, edges, limits, truncated);
    }
    if (added) {
      issueQueue.push(issue.key);
    }
  };

  const enqueuePage = (page: JiraLinkedPage, from: string, relation: string) => {
    const added = addPage(page, pageMap, visitedPages, limits, truncated);
    addEdge({ from, to: `page:${page.id}`, relation }, edges, limits, truncated);
    if (added) {
      pageQueue.push(page.id);
    }
  };

  enqueueIssue(input.root.ticket);

  while (issueQueue.length > 0) {
    const currentKey = issueQueue.shift();
    if (!currentKey) {
      continue;
    }

    const current = issueGraphByKey[currentKey];
    if (!current) {
      continue;
    }

    if (current.epic) {
      enqueueIssue(current.epic, current.ticket.key, 'epic');
    }

    if (current.parent) {
      enqueueIssue(current.parent, current.ticket.key, 'parent');
    }

    for (const subtask of current.subtasks ?? []) {
      enqueueIssue(subtask, current.ticket.key, 'subtask');
    }

    for (const linkedIssue of current.linkedIssues ?? []) {
      enqueueIssue(asTicketFromLinkedIssue(linkedIssue), current.ticket.key, linkedIssue.relation ?? 'linked_issue');
    }

    for (const linkedPage of current.linkedPages ?? []) {
      enqueuePage(linkedPage, current.ticket.key, 'linked_page');
    }

    if (current.ticket.type === 'task') {
      for (const subtask of current.subtasks ?? []) {
        enqueueIssue(subtask, current.ticket.key, 'task_subtask_required');
      }
    }

    if (current.ticket.type === 'sub-task' && current.parent) {
      enqueueIssue(current.parent, current.ticket.key, 'subtask_parent_required');
    }
  }

  while (pageQueue.length > 0) {
    const currentPageId = pageQueue.shift();
    if (!currentPageId) {
      continue;
    }

    const pageNode = input.pageGraphById?.[currentPageId];
    if (!pageNode) {
      continue;
    }

    for (const linkedIssue of pageNode.linkedIssues ?? []) {
      const issue = asTicketFromLinkedIssue(linkedIssue);
      enqueueIssue(issue, `page:${currentPageId}`, 'page_linked_issue');
    }

    for (const linkedPage of pageNode.linkedPages ?? []) {
      enqueuePage(linkedPage, `page:${currentPageId}`, 'page_linked_page');
    }
  }

  return {
    issues: [...issueMap.values()],
    pages: [...pageMap.values()],
    edges,
    visitedIssues,
    visitedPages,
    truncated
  };
}
