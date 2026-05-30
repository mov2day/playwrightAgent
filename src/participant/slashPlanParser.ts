import type { InvalidTicketSoftFailCommand, NoTicketPlanCommand, PlanParseResult, TicketPlanCommand } from '../pipeline/contracts';

const TICKET_PATTERN = /^[A-Z][A-Z0-9]+-[0-9]+$/;
const TICKET_LIKE_PATTERN = /^[A-Za-z0-9]+-[A-Za-z0-9-]+$/;

function stripPlanCommand(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith('/plan')) {
    return trimmed;
  }
  return trimmed.slice('/plan'.length).trim();
}

function splitHead(input: string): { head: string; tail: string } {
  const trimmed = input.trim();
  const firstSpace = trimmed.indexOf(' ');

  if (firstSpace === -1) {
    return { head: trimmed, tail: '' };
  }

  return {
    head: trimmed.slice(0, firstSpace),
    tail: trimmed.slice(firstSpace + 1).trim()
  };
}

function buildNoTicket(userContext: string, normalizedInput: string, warnings: string[] = []): NoTicketPlanCommand {
  return {
    mode: 'no_ticket',
    userContext,
    warnings,
    normalizedInput
  };
}

function buildInvalid(rawToken: string, userContext: string, normalizedInput: string, warning: string): InvalidTicketSoftFailCommand {
  return {
    mode: 'invalid_ticket_soft_fail',
    rawToken,
    userContext,
    warnings: [warning],
    normalizedInput
  };
}

function buildTicket(ticketId: string, userContext: string, normalizedInput: string): TicketPlanCommand {
  return {
    mode: 'ticket',
    ticketId,
    userContext,
    warnings: [],
    normalizedInput
  };
}

function isValidTicket(token: string): boolean {
  return TICKET_PATTERN.test(token);
}

function looksLikeTicketToken(token: string): boolean {
  return TICKET_LIKE_PATTERN.test(token);
}

export function parseSlashPlanInput(rawInput: string): PlanParseResult {
  const normalizedInput = stripPlanCommand(rawInput);
  if (normalizedInput.length === 0) {
    return buildNoTicket('', normalizedInput);
  }

  const { head, tail } = splitHead(normalizedInput);

  if (head === '--ticket') {
    if (!tail) {
      return buildInvalid('--ticket', '', normalizedInput, 'Expected a ticket token after --ticket. Continuing in no-ticket mode.');
    }

    const { head: explicitToken, tail: explicitTail } = splitHead(tail);
    if (isValidTicket(explicitToken)) {
      return buildTicket(explicitToken, explicitTail, normalizedInput);
    }

    return buildInvalid(
      explicitToken,
      explicitTail,
      normalizedInput,
      `Ticket '${explicitToken}' is invalid. Continuing in no-ticket mode.`
    );
  }

  if (isValidTicket(head)) {
    return buildTicket(head, tail, normalizedInput);
  }

  if (looksLikeTicketToken(head)) {
    return buildInvalid(
      head,
      normalizedInput,
      normalizedInput,
      `Token '${head}' does not match strict ticket format ABC-123. Continuing in no-ticket mode.`
    );
  }

  return buildNoTicket(normalizedInput, normalizedInput);
}
