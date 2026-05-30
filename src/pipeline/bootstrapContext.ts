import type { PlanParseResult, RequestContext, UserInputContext } from './contracts';

export interface BootstrapContextDeps {
  requestIdFactory?: () => string;
  now?: () => Date;
}

function defaultRequestIdFactory(): string {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `req_${Date.now()}_${entropy}`;
}

function toUserInputContext(text: string): UserInputContext | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  return {
    source: 'user_input',
    text: trimmed
  };
}

export function buildRequestContext(parseResult: PlanParseResult, deps: BootstrapContextDeps = {}): RequestContext {
  const requestIdFactory = deps.requestIdFactory ?? defaultRequestIdFactory;
  const now = deps.now ?? (() => new Date());
  const requestId = requestIdFactory();

  const context: RequestContext = {
    requestId,
    mode: parseResult.mode,
    warnings: parseResult.warnings,
    createdAt: now().toISOString(),
    stage: 'context_bootstrapped'
  };

  if ('ticketId' in parseResult) {
    context.ticketId = parseResult.ticketId;
  }

  const userContext = toUserInputContext(parseResult.userContext);
  if (userContext) {
    context.userContext = userContext;
  }

  return context;
}
