import { redactSensitiveText, runLocalToolCommand, type LocalToolCommandResult } from './localToolRunner';

export interface JiraTicketDetails {
  key: string;
  type: string;
  summary: string;
  description?: string;
  status?: string;
}

export interface JiraComment {
  id: string;
  author?: string;
  body: string;
  createdAt?: string;
}

export interface JiraAttachment {
  id: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  url?: string;
  extractedText?: string;
}

export interface JiraLinkedIssue {
  key: string;
  relation?: string;
  summary?: string;
  type?: string;
  status?: string;
}

export interface JiraLinkedPage {
  id: string;
  title: string;
  url?: string;
}

export type JiraCompletenessStatus = 'full' | 'partial';

export interface JiraCompleteness {
  status: JiraCompletenessStatus;
  reasons: string[];
}

export interface JiraTicketGraphPayload {
  ticket: JiraTicketDetails;
  comments: JiraComment[];
  attachments: JiraAttachment[];
  linkedIssues: JiraLinkedIssue[];
  linkedPages: JiraLinkedPage[];
  epic?: JiraTicketDetails;
  parent?: JiraTicketDetails;
  subtasks: JiraTicketDetails[];
  completeness: JiraCompleteness;
}

export interface JiraFetchInput {
  ticketId: string;
  requestId: string;
  timeoutMs?: number;
}

export interface JiraClient {
  fetchTicketGraph(input: JiraFetchInput): Promise<JiraTicketGraphPayload>;
}

export interface LocalToolJiraClientOptions {
  command?: string;
  baseArgs?: string[];
  timeoutMs?: number;
  runner?: (command: string, args: string[], timeoutMs?: number) => Promise<LocalToolCommandResult>;
}

function toSafeError(message: string): string {
  return redactSensitiveText(message);
}

function normalizePayload(raw: unknown, fallbackTicketId: string): JiraTicketGraphPayload {
  const baseTicket: JiraTicketDetails = {
    key: fallbackTicketId,
    type: 'task',
    summary: 'Unavailable'
  };

  if (!raw || typeof raw !== 'object') {
    return {
      ticket: baseTicket,
      comments: [],
      attachments: [],
      linkedIssues: [],
      linkedPages: [],
      subtasks: [],
      completeness: {
        status: 'partial',
        reasons: ['Invalid Jira tool payload shape']
      }
    };
  }

  const payload = raw as Partial<JiraTicketGraphPayload>;

  return {
    ticket: payload.ticket ?? baseTicket,
    comments: payload.comments ?? [],
    attachments: payload.attachments ?? [],
    linkedIssues: payload.linkedIssues ?? [],
    linkedPages: payload.linkedPages ?? [],
    epic: payload.epic,
    parent: payload.parent,
    subtasks: payload.subtasks ?? [],
    completeness: payload.completeness ?? {
      status: 'partial',
      reasons: ['Completeness metadata missing from Jira tool output']
    }
  };
}

export class LocalToolJiraClient implements JiraClient {
  private readonly command: string;

  private readonly baseArgs: string[];

  private readonly timeoutMs: number;

  private readonly runner: (command: string, args: string[], timeoutMs?: number) => Promise<LocalToolCommandResult>;

  constructor(options: LocalToolJiraClientOptions = {}) {
    this.command = options.command ?? 'node';
    this.baseArgs = options.baseArgs ?? ['scripts/jira-fetch.mjs'];
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.runner = options.runner ?? runLocalToolCommand;
  }

  async fetchTicketGraph(input: JiraFetchInput): Promise<JiraTicketGraphPayload> {
    const result = await this.runner(
      this.command,
      [...this.baseArgs, '--ticket', input.ticketId, '--request-id', input.requestId],
      input.timeoutMs ?? this.timeoutMs
    );

    if (!result.ok) {
      const errorText = toSafeError(result.error ?? result.stderr ?? 'Unknown Jira tooling failure');
      if (result.timedOut) {
        throw new Error(`Jira local tooling timed out: ${errorText}`);
      }
      throw new Error(`Jira local tooling failed: ${errorText}`);
    }

    try {
      const parsed = JSON.parse(result.stdout) as unknown;
      return normalizePayload(parsed, input.ticketId);
    } catch (error) {
      const parseError = error instanceof Error ? error.message : String(error);
      throw new Error(`Jira local tooling returned invalid JSON: ${toSafeError(parseError)}`);
    }
  }
}
