export type PlanMode = 'ticket' | 'no_ticket' | 'invalid_ticket_soft_fail';

export interface TicketPlanCommand {
  mode: 'ticket';
  ticketId: string;
  userContext: string;
  warnings: string[];
  normalizedInput: string;
}

export interface NoTicketPlanCommand {
  mode: 'no_ticket';
  userContext: string;
  warnings: string[];
  normalizedInput: string;
}

export interface InvalidTicketSoftFailCommand {
  mode: 'invalid_ticket_soft_fail';
  rawToken: string;
  userContext: string;
  warnings: string[];
  normalizedInput: string;
}

export type PlanParseResult = TicketPlanCommand | NoTicketPlanCommand | InvalidTicketSoftFailCommand;

export interface UserInputContext {
  source: 'user_input';
  text: string;
}

export interface RequestContext {
  requestId: string;
  mode: PlanMode;
  ticketId?: string;
  userContext?: UserInputContext;
  warnings: string[];
  createdAt: string;
  stage: 'context_bootstrapped';
}
