import {
  redactSensitiveText,
  runLocalToolCommand,
  type LocalToolRunner
} from './localToolRunner';

export interface ConfluenceQuery {
  queryText: string;
  sourceEntity: string;
  priority: number;
  maxResults: number;
}

export interface ConfluencePage {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
  lastUpdatedAt?: string;
  linkedJiraKeys?: string[];
}

export interface ConfluenceSearchInput {
  requestId: string;
  queries: ConfluenceQuery[];
  timeoutMs?: number;
}

export interface ConfluenceClient {
  searchPages(input: ConfluenceSearchInput): Promise<ConfluencePage[]>;
}

export interface LocalToolConfluenceClientOptions {
  command?: string;
  baseArgs?: string[];
  timeoutMs?: number;
  cwd?: string;
  runner?: LocalToolRunner;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_BASE_ARGS = ['scripts/confluence-search.mjs'];

function normalizePages(raw: unknown): ConfluencePage[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is ConfluencePage => {
      return !!item && typeof item === 'object' && typeof (item as ConfluencePage).id === 'string';
    });
  }

  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const candidate = raw as {
    pages?: unknown;
  };

  if (!Array.isArray(candidate.pages)) {
    return [];
  }

  return candidate.pages.filter((item): item is ConfluencePage => {
    return !!item && typeof item === 'object' && typeof (item as ConfluencePage).id === 'string';
  });
}

export class LocalToolConfluenceClient implements ConfluenceClient {
  private readonly command: string;

  private readonly baseArgs: string[];

  private readonly timeoutMs: number;

  private readonly cwd?: string;

  private readonly runner: LocalToolRunner;

  constructor(options: LocalToolConfluenceClientOptions = {}) {
    this.command = options.command ?? 'node';
    this.baseArgs = options.baseArgs ?? DEFAULT_BASE_ARGS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cwd = options.cwd;
    this.runner = options.runner ?? runLocalToolCommand;
  }

  async searchPages(input: ConfluenceSearchInput): Promise<ConfluencePage[]> {
    const result = await this.runner(
      this.command,
      [...this.baseArgs, '--request-id', input.requestId, '--queries-json', JSON.stringify(input.queries)],
      {
        timeoutMs: input.timeoutMs ?? this.timeoutMs,
        cwd: this.cwd
      }
    );

    if (!result.ok) {
      const errorMessage = redactSensitiveText(result.error ?? result.stderr ?? 'Unknown Confluence tool failure');
      const prefix = result.timedOut ? 'Confluence local tooling timed out' : 'Confluence local tooling failed';
      throw new Error(`${prefix}: ${errorMessage}`);
    }

    try {
      const parsed = JSON.parse(result.stdout) as unknown;
      return normalizePages(parsed);
    } catch (error) {
      const parseError = error instanceof Error ? error.message : String(error);
      throw new Error(`Confluence local tooling returned invalid JSON: ${redactSensitiveText(parseError)}`);
    }
  }
}
