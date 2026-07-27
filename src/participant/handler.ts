import type { ConfluenceClient } from '../adapters/confluenceClient';
import type { EventSink, PipelineEvent } from '../adapters/eventSink';
import type { JiraClient } from '../adapters/jiraClient';
import { createDefaultEventSink } from '../adapters/eventSink';
import { redactSensitiveText, redactSensitiveValue } from '../adapters/localToolRunner';
import { buildRequestContext } from '../pipeline/bootstrapContext';
import {
  DEFAULT_CONFIDENCE_PROFILE,
  type ConfidenceDecisionInput,
  type ConfidenceGate,
  type ConfidenceWeightProfile
} from '../pipeline/confidence/confidenceContracts';
import { computeConfidenceDecision } from '../pipeline/confidence/confidenceEngine';
import {
  buildConfidenceExplainability,
  type ConfidenceExplainability
} from '../pipeline/confidence/explainability';
import { PIPELINE_EVENT_SCHEMA_VERSION } from '../pipeline/events';
import { buildConfluenceContext } from '../pipeline/context/confluenceContextBuilder';
import type { ConfluenceContextResult } from '../pipeline/context/confluenceContextBuilder';
import { buildJiraContext, type JiraContextResult } from '../pipeline/context/jiraContextBuilder';
import type { PlanMode } from '../pipeline/contracts';
import type { PlanReviewBundle, ScenarioPlanRecord } from '../pipeline/planning/planContracts';
import { buildPlanReviewBundle } from '../pipeline/planning/scenarioGrouping';
import { buildScenarioPlan, type RequirementScenarioInput } from '../pipeline/planning/scenarioMapper';
import { formatPlanChatSummary } from '../pipeline/planning/planSummary';
import {
  analyzeRepositoryContext
} from '../pipeline/repoAnalysis/repoAnalyzer';
import type { RepoAnalysisResult } from '../pipeline/repoAnalysis/contracts';
import type {
  ActionTransitionResult,
  ExecuteScopedRunOptions,
  ExecutionRunResult,
  PipelineOrchestrator,
  StageEntryDecision
} from '../pipeline/orchestrator';
import type { PipelineState } from '../pipeline/stateMachine';
import { createPreviewApproveAllAction } from '../ui/previewActions';
import { parseSlashPlanInput } from './slashPlanParser';
import { isQuickAction, QUICK_ACTIONS, type QuickAction } from './actions';

const CONFIDENCE_GATE_ACTIONS: Record<ConfidenceGate, readonly QuickAction[]> = {
  reject: ['cancel'],
  approval_required: ['approve', 'reject', 'cancel'],
  continue: ['approve', 'reject', 'cancel']
};

const NO_TICKET_CONFIDENCE_PROFILE: ConfidenceWeightProfile = {
  profileId: 'v1-no-ticket',
  version: '1.0.0',
  weights: {
    repo: 0.5,
    jira: 0,
    confluence: 0,
    user_context: 0.5
  }
};

type FreeTextPurpose = 'additional_context_or_instruction';
type FreeTextCommentTarget = 'scenario' | 'global';
type FreeTextCommentClassification = 'clarification' | 'constraint' | 'bug' | 'new_context';

interface ClassifiedFreeTextComment {
  target: 'scenario' | 'global';
  classification: 'clarification' | 'constraint' | 'bug' | 'new_context';
  scenarioId?: string;
  text: string;
}

interface RequestSnapshot {
  requestId: string;
  mode: PlanMode;
  ticketId?: string;
  warnings: string[];
  userContextParts: string[];
  runtimePlanContext?: RuntimePlanContext;
  confidenceProfile?: ConfidenceWeightProfile;
  messageOverride?: string;
}

const REQUEST_SNAPSHOTS = new Map<string, RequestSnapshot>();

function patchRequestSnapshot(requestId: string, patch: Partial<RequestSnapshot>): void {
  const snapshot = REQUEST_SNAPSHOTS.get(requestId);
  if (!snapshot) {
    return;
  }

  REQUEST_SNAPSHOTS.set(requestId, {
    ...snapshot,
    ...patch
  });
}

export interface ConfidenceInputFactoryArgs {
  requestId: string;
  mode: PlanMode;
  ticketId?: string;
  userContext?: string;
  warnings: string[];
  freeTextContext: string[];
}

export interface PlanBundleFactoryArgs {
  requestId: string;
  mode: PlanMode;
  ticketId?: string;
  userContext?: string;
  warnings: string[];
}

export interface PlanCommandResponse {
  requestId: string;
  mode: PlanMode;
  state?: PipelineState;
  ticketId?: string;
  message: string;
  userContext?: string;
  warnings: string[];
  availableActions: readonly QuickAction[];
  confidenceScore: number;
  decisionGate: ConfidenceGate;
  confidenceProfileId: string;
  acceptsFreeText: boolean;
  freeTextPurpose: FreeTextPurpose;
  explainability: ConfidenceExplainability;
  stageEntryDecision?: StageEntryDecision;
  planSummary?: string;
  planScenarios?: readonly ScenarioPlanRecord[];
}

export interface ParticipantHandlerDeps {
  eventSink?: EventSink;
  requestIdFactory?: () => string;
  now?: () => Date;
  orchestrator?: PipelineOrchestrator;
  repoRootDir?: string;
  jiraClient?: JiraClient;
  confluenceClient?: ConfluenceClient;
  confidenceProfile?: ConfidenceWeightProfile;
  confidenceInputFactory?: (args: ConfidenceInputFactoryArgs) => ConfidenceDecisionInput;
  planBundleFactory?: (args: PlanBundleFactoryArgs) => PlanReviewBundle | undefined;
  executionRunOptions?: Pick<ExecuteScopedRunOptions, 'commandRunner' | 'applyScopedAutoFix'>;
}

interface ChatRequestLike {
  prompt: string;
}

interface ChatResponseStreamLike {
  markdown: (value: string) => void;
}

interface RuntimeConfidenceContext {
  confidenceInput: ConfidenceDecisionInput;
  warnings: string[];
  confidenceProfile?: ConfidenceWeightProfile;
  runtimePlanContext?: RuntimePlanContext;
  messageOverride?: string;
}

interface RuntimePlanContext {
  repoAnalysis?: RepoAnalysisResult;
  jiraContext?: JiraContextResult;
  confluenceContext?: ConfluenceContextResult;
}

interface ChatContextLike {
  history?: readonly unknown[];
}

interface ChatRequestActionContext {
  requestId: string;
  availableActions: QuickAction[];
}

function isChatRequestLike(value: unknown): value is ChatRequestLike {
  return !!value && typeof value === 'object' && typeof (value as { prompt?: unknown }).prompt === 'string';
}

function isChatResponseStreamLike(value: unknown): value is ChatResponseStreamLike {
  return !!value && typeof value === 'object' && typeof (value as { markdown?: unknown }).markdown === 'function';
}

function isChatContextLike(value: unknown): value is ChatContextLike {
  return !!value && typeof value === 'object';
}

function clampScore(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

function scoreUserContext(userContext: string | undefined): number {
  if (!userContext?.trim()) {
    return 0;
  }

  const normalized = userContext.trim();
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const tokenContribution = Math.min(24, tokenCount * 2);
  const lengthContribution = Math.min(38, normalized.length / 18);

  return clampScore(30 + tokenContribution + lengthContribution);
}

function appendUnique(target: string[], values: readonly string[]): void {
  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

function toSafeError(error: unknown): string {
  if (error instanceof Error) {
    const firstLine = error.message.split('\n').map((line) => line.trim()).find(Boolean) ?? error.message;
    return redactSensitiveText(firstLine).slice(0, 220);
  }
  return 'Unknown error';
}

function toQuickActions(value: unknown): QuickAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const actions: QuickAction[] = [];
  for (const item of value) {
    if (typeof item === 'string' && isQuickAction(item)) {
      actions.push(item);
    }
  }

  return actions;
}

function extractLatestActionContext(contextArg: unknown): ChatRequestActionContext | undefined {
  if (!isChatContextLike(contextArg) || !Array.isArray(contextArg.history)) {
    return undefined;
  }

  for (let index = contextArg.history.length - 1; index >= 0; index -= 1) {
    const turn = contextArg.history[index] as {
      result?: {
        metadata?: {
          playwrightAgent?: {
            requestId?: unknown;
            availableActions?: unknown;
          };
        };
      };
    };

    const meta = turn.result?.metadata?.playwrightAgent;
    if (!meta || typeof meta.requestId !== 'string') {
      continue;
    }

    return {
      requestId: meta.requestId,
      availableActions: toQuickActions(meta.availableActions)
    };
  }

  return undefined;
}

function getLastKnownRequestId(): string | undefined {
  let lastId: string | undefined;
  for (const requestId of REQUEST_SNAPSHOTS.keys()) {
    lastId = requestId;
  }
  return lastId;
}

function actionsForState(state: PipelineState | undefined, _decisionGate?: ConfidenceGate): QuickAction[] {
  if (!state) {
    return [];
  }

  if (state === 'awaiting_guardrail_decision') {
    return ['approve', 'reject', 'continue', 'cancel'];
  }
  if (state === 'awaiting_plan_approval') {
    return ['approve', 'reject', 'cancel'];
  }
  if (state === 'awaiting_script_approval') {
    return ['approve', 'reject', 'cancel'];
  }
  if (state === 'plan_approved' || state === 'script_approved') {
    return ['continue', 'cancel'];
  }

  return [];
}

function buildChatResultMetadata(
  requestId: string,
  availableActions: readonly QuickAction[],
  mode?: PlanMode,
  decisionGate?: ConfidenceGate,
  state?: PipelineState,
  response?: Pick<PlanCommandResponse, 'planSummary' | 'planScenarios'>
): { metadata: { playwrightAgent: { requestId: string; availableActions: readonly QuickAction[]; mode?: PlanMode; decisionGate?: ConfidenceGate; state?: PipelineState; planSummary?: string; planScenarios?: readonly ScenarioPlanRecord[] } } } {
  return {
    metadata: {
      playwrightAgent: {
        requestId,
        availableActions,
        mode,
        decisionGate,
        state,
        planSummary: response?.planSummary,
        planScenarios: response?.planScenarios
      }
    }
  };
}

async function buildRuntimeConfidenceContext(
  rawInput: string,
  deps: ParticipantHandlerDeps
): Promise<RuntimeConfidenceContext | undefined> {
  if (deps.confidenceInputFactory) {
    return undefined;
  }

  const parseResult = parseSlashPlanInput(rawInput);
  const userContext = parseResult.userContext?.trim();

  const warnings: string[] = [];
  const reasons: string[] = [];
  const evidence: ConfidenceDecisionInput['evidence'] = [];
  const runtimePlanContext: RuntimePlanContext = {};
  const componentScores: ConfidenceDecisionInput['componentScores'] = {
    repo: 0,
    jira: 0,
    confluence: 0,
    user_context: scoreUserContext(userContext)
  };
  let confidenceProfile: ConfidenceWeightProfile | undefined;
  let messageOverride: string | undefined;

  if (!userContext) {
    reasons.push('No explicit user context provided.');
  } else {
    evidence.push({
      source: 'user_context',
      snippet: userContext.slice(0, 240)
    });
    reasons.push(`User context included (${userContext.split(/\s+/).filter(Boolean).length} tokens).`);
  }

  try {
    const repoAnalysis = analyzeRepositoryContext({
      rootDir: deps.repoRootDir ?? process.cwd()
    });
    runtimePlanContext.repoAnalysis = repoAnalysis;
    componentScores.repo = clampScore(repoAnalysis.summary.overallConfidence * 100);
    appendUnique(
      warnings,
      repoAnalysis.summary.warnings.slice(0, 2).map((warning) => `repo: ${warning}`)
    );
    reasons.push(
      `Repo analysis ran: framework=${repoAnalysis.summary.framework}, pattern=${repoAnalysis.summary.pattern.primaryPattern}, reuseCandidates=${repoAnalysis.summary.reuseCandidates.length}.`
    );
    const topFinding = repoAnalysis.findings[0];
    if (topFinding) {
      evidence.push({
        source: 'repo',
        findingId: topFinding.id,
        snippet: `${topFinding.result} (${Math.round(topFinding.confidence * 100)}%)`
      });
    }
  } catch (error) {
    componentScores.repo = 20;
    warnings.push(`repo: analysis failed (${toSafeError(error)})`);
    reasons.push('Repo analysis failed; conservative score applied.');
  }

  if (parseResult.mode !== 'ticket') {
    componentScores.jira = 0;
    componentScores.confluence = 0;
    confidenceProfile = NO_TICKET_CONFIDENCE_PROFILE;
    reasons.push('No valid ticket context; Jira/Confluence scoring is disabled for no-ticket flow.');

    return {
      confidenceInput: {
        componentScores,
        evidence,
        reasons
      },
      warnings,
      confidenceProfile,
      runtimePlanContext
    };
  }

  if (!deps.jiraClient) {
    componentScores.jira = 0;
    componentScores.confluence = 0;
    componentScores.user_context = 0;
    warnings.push('jira: local tooling client not configured; ticket mode is blocked.');
    reasons.push('Ticket mode requires local Jira tooling before planning can begin.');
    messageOverride = 'Ticket mode is blocked because Jira local tooling is not configured. Configure the local Jira fetch script, or run `/plan` without a ticket and provide full manual context.';

    return {
      confidenceInput: {
        componentScores,
        evidence,
        reasons
      },
      warnings,
      runtimePlanContext,
      messageOverride
    };
  }

  confidenceProfile = createTicketConfidenceProfile(false);

  try {
    const requestId = `runtime_${Date.now().toString(36)}`;
    const jiraContext = await buildJiraContext({
      client: deps.jiraClient,
      ticketId: parseResult.ticketId,
      requestId,
      stageBudgetMs: 12_000,
      fetchTimeoutMs: 8_000
    });
    runtimePlanContext.jiraContext = jiraContext;

    const issueCount = jiraContext.issues.length;
    const hasTruncation = jiraContext.truncated.issues || jiraContext.truncated.pages || jiraContext.truncated.edges;
    const hasFetchFailure = jiraContext.completeness.reasons.includes('fetch_failed')
      || jiraContext.metrics.successfulFetches === 0;
    const hasTimeoutFailure = jiraContext.completeness.reasons.includes('timeout');
    const rootIssue = jiraContext.issues[0]?.payload.ticket;
    const acceptanceCriteriaLines = extractAcceptanceCriteriaLines(rootIssue?.description);
    const descriptionLines = collectRequirementLines(rootIssue?.description);
    const structuralCoverage = Math.min(12, Math.max(0, issueCount - 1) * 3);

    if (hasFetchFailure || hasTimeoutFailure) {
      componentScores.jira = hasTimeoutFailure ? 8 : 5;
      warnings.push(
        hasTimeoutFailure
          ? 'jira: ticket retrieval timed out; confidence hard-limited.'
          : 'jira: ticket retrieval failed; confidence hard-limited.'
      );
      reasons.push(
        hasTimeoutFailure
          ? 'Jira retrieval timed out before usable ticket context was assembled.'
          : 'Jira retrieval failed before usable ticket context was assembled.'
      );
    } else {
      const descriptionScore = descriptionLines.length > 0
        ? Math.min(28, 12 + Math.min(16, descriptionLines.join(' ').length / 20))
        : 0;
      const acceptanceCriteriaScore = acceptanceCriteriaLines.length > 0
        ? Math.min(35, 18 + (acceptanceCriteriaLines.length * 4))
        : 0;
      const partialPenalty = jiraContext.completeness.status === 'partial'
        ? Math.min(18, jiraContext.completeness.reasons.length * 4)
        : 0;
      const truncationPenalty = hasTruncation ? 8 : 0;
      const completenessBonus = jiraContext.completeness.status === 'full' ? 10 : 0;
      componentScores.jira = clampScore(
        descriptionScore + acceptanceCriteriaScore + structuralCoverage + completenessBonus - partialPenalty - truncationPenalty
      );

      if (acceptanceCriteriaLines.length === 0) {
        warnings.push('jira: acceptance criteria were not clearly detected in the ticket description.');
      }
      if (descriptionLines.length === 0) {
        warnings.push('jira: ticket description is thin; planning will rely more on explicit user context.');
      }
    }

    reasons.push(
      `Jira fetch ran: issues=${issueCount}, completeness=${jiraContext.completeness.status}, acceptanceCriteria=${acceptanceCriteriaLines.length}, retries=${jiraContext.metrics.retries}.`
    );
    if (jiraContext.completeness.reasons.length > 0) {
      warnings.push(`jira: ${jiraContext.completeness.reasons.join(', ')}`);
    }

    if (rootIssue) {
      evidence.push({
        source: 'jira',
        issueKey: rootIssue.key,
        snippet: rootIssue.summary
      });
    }

    if (!deps.confluenceClient) {
      componentScores.confluence = 0;
      warnings.push('confluence: local tooling client not configured; search skipped.');
      reasons.push('Confluence client missing; score stays neutral until relevant pages are available.');
    } else {
      try {
        const confluenceContext = await buildConfluenceContext(jiraContext, {
          client: deps.confluenceClient,
          queryLimit: 12,
          maxResultsPerQuery: 3,
          queryTimeoutMs: 8_000
        });
        runtimePlanContext.confluenceContext = confluenceContext;

        if (confluenceContext.highCount > 0) {
          confidenceProfile = createTicketConfidenceProfile(true);
          componentScores.confluence = clampScore(70 + Math.min(20, confluenceContext.highCount * 4));
        } else if (confluenceContext.midCount > 0) {
          confidenceProfile = createTicketConfidenceProfile(true);
          componentScores.confluence = clampScore(45 + Math.min(12, confluenceContext.midCount * 3));
        } else {
          componentScores.confluence = 0;
        }

        reasons.push(
          `Confluence search ran: queries=${confluenceContext.queries.length}, high=${confluenceContext.highCount}, mid=${confluenceContext.midCount}.`
        );

        if (confluenceContext.highCount === 0 && confluenceContext.midCount === 0) {
          warnings.push('confluence: no relevant pages found for current Jira context; excluded from planning context.');
        }

        const topPage = confluenceContext.scoringContribution[0]?.page;
        if (topPage) {
          evidence.push({
            source: 'confluence',
            pageId: topPage.id,
            snippet: topPage.title
          });
        }
      } catch (error) {
        componentScores.confluence = 0;
        warnings.push(`confluence: fetch failed (${toSafeError(error)})`);
        reasons.push('Confluence retrieval failed; score stays neutral.');
      }
    }
  } catch (error) {
    componentScores.jira = 8;
    componentScores.confluence = 0;
    warnings.push(`jira: fetch failed (${toSafeError(error)})`);
    reasons.push('Jira retrieval failed; confidence forced to conservative range.');
  }

  return {
    confidenceInput: {
      componentScores,
        evidence,
        reasons
      },
    warnings,
    confidenceProfile,
    runtimePlanContext,
    messageOverride
  };
}

function emitEvent(
  sink: EventSink,
  requestId: string,
  stage: string,
  action: string,
  now: () => Date,
  details?: Record<string, unknown>,
  confidenceProfileId?: string,
  decisionGate?: ConfidenceGate,
  decisionAction?: 'approve' | 'reject' | 'continue' | 'cancel',
  decisionComment?: string
): void {
  const sanitizedDetails = details
    ? (redactSensitiveValue(details) as Record<string, unknown>)
    : undefined;
  const interactionType = stage === 'gate' ? 'gate_decision' : 'ai_interaction';
  const event: PipelineEvent = {
    requestId,
    stage,
    action,
    timestamp: now().toISOString(),
    schemaVersion: PIPELINE_EVENT_SCHEMA_VERSION,
    interactionType,
    decisionAction,
    decisionComment: decisionComment ? redactSensitiveText(decisionComment) : undefined,
    confidenceProfileId,
    decisionGate,
    details: sanitizedDetails
  };
  sink.emit(event);
}

function defaultConfidenceInputFactory(args: ConfidenceInputFactoryArgs): ConfidenceDecisionInput {
  const userContextScore = args.userContext
    ? Math.min(85, 60 + (args.userContext.length / 12))
    : 45;

  return {
    componentScores: {
      repo: 62,
      jira: args.mode === 'ticket' ? 72 : 56,
      confluence: args.ticketId ? 54 : 48,
      user_context: userContextScore
    },
    evidence: [
      args.ticketId
        ? {
            source: 'jira',
            issueKey: args.ticketId,
            snippet: `ticket=${args.ticketId}`
          }
        : {
            source: 'user_context',
            snippet: args.userContext ?? ''
          }
    ],
    reasons: args.warnings
  };
}

function joinUserContext(parts: string[]): string | undefined {
  const merged = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n');

  return merged ? merged : undefined;
}

function createTicketConfidenceProfile(includeConfluence: boolean): ConfidenceWeightProfile {
  return {
    profileId: includeConfluence ? 'v1-ticket-context-with-confluence' : 'v1-ticket-context',
    version: '1.0.0',
    weights: {
      repo: 0.2,
      jira: 0.55,
      confluence: includeConfluence ? 0.1 : 0,
      user_context: 0.25
    }
  };
}

function normalizePlanningText(value: string | undefined): string {
  return (value ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[*_>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickFunctionality(sentence: string): string {
  const tokens = sentence
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);

  return tokens[0]
    ? `${tokens[0][0]?.toUpperCase() ?? ''}${tokens[0].slice(1)}`
    : 'General';
}

function splitScenarioSentences(userContext: string | undefined): string[] {
  const normalized = normalizePlanningText(userContext);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/[\n.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function collectRequirementLines(value: string | undefined): string[] {
  const normalized = normalizePlanningText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?:\.\s+|\n|;\s+)/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length >= 18);
}

function extractAcceptanceCriteriaLines(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  const sourceLines = value.split('\n').map((line) => line.trim()).filter(Boolean);
  const collected: string[] = [];
  let inAcceptanceSection = false;

  for (const line of sourceLines) {
    const normalized = line.toLowerCase();
    if (/acceptance criteria|acceptance criteria:|ac:/i.test(line)) {
      inAcceptanceSection = true;
      continue;
    }

    if (inAcceptanceSection && /^[A-Z][A-Za-z ]+:$/.test(line)) {
      break;
    }

    const cleaned = line.replace(/^[-*]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
    const looksLikeCriterion = /\b(when|then|must|should|can|cannot|verify|ensure|given)\b/i.test(cleaned);
    if ((inAcceptanceSection || looksLikeCriterion) && cleaned.length >= 12) {
      collected.push(cleaned);
    }
  }

  return [...new Set(collected)].slice(0, 8);
}

function toScenarioName(value: string, fallbackPrefix: string, index: number): string {
  const normalized = value
    .replace(/\b(given|when|then|and)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const title = normalized
    ? `${normalized[0]?.toUpperCase() ?? ''}${normalized.slice(1)}`
    : `${fallbackPrefix} path ${index + 1}`;

  return title.length <= 90 ? title : `${title.slice(0, 87)}...`;
}

function createScopeLabel(rootSummary: string | undefined, repoAnalysis: RepoAnalysisResult | undefined): string {
  const repoBits = [
    repoAnalysis?.summary.framework,
    repoAnalysis?.summary.pattern.primaryPattern
  ].filter(Boolean);

  if (rootSummary?.trim() && repoBits.length > 0) {
    return `${rootSummary.trim()} (${repoBits.join(', ')})`;
  }

  return rootSummary?.trim() || 'End-to-end scenario validation';
}

function buildRuntimeScenarioInputs(
  args: PlanBundleFactoryArgs,
  runtimePlanContext: RuntimePlanContext
): RequirementScenarioInput[] {
  const userSentences = splitScenarioSentences(args.userContext);
  const repoAnalysis = runtimePlanContext.repoAnalysis;
  const jiraContext = runtimePlanContext.jiraContext;
  const confluenceContext = runtimePlanContext.confluenceContext;

  if (args.mode !== 'ticket' || !jiraContext || jiraContext.metrics.successfulFetches === 0) {
    return toScenarioInputs(args);
  }

  const rootIssue = jiraContext.issues[0]?.payload.ticket;
  const rootSummary = rootIssue?.summary?.trim();
  const requirementPrefix = rootIssue?.key ?? args.ticketId?.toUpperCase() ?? 'PLAN-MANUAL';
  const acceptanceCriteriaLines = extractAcceptanceCriteriaLines(rootIssue?.description);
  const descriptionLines = collectRequirementLines(rootIssue?.description).slice(0, 4);
  const subtaskLines = jiraContext.issues
    .slice(1)
    .map((issue) => issue.payload.ticket.summary?.trim())
    .filter((value): value is string => Boolean(value && value.length >= 12))
    .slice(0, 3);
  const confluenceLines = (confluenceContext?.scoringContribution ?? [])
    .slice(0, 2)
    .map((entry) => normalizePlanningText([entry.page.title, entry.page.snippet ?? ''].join(' - ')))
    .filter((value) => value.length >= 18);

  const candidateSeeds = [
    ...userSentences.map((text, index) => ({
      text,
      source: 'user' as const,
      requirementId: `${requirementPrefix}-USR-${index + 1}`,
      evidenceIds: [`ctx_${index + 1}`, requirementPrefix]
    })),
    ...acceptanceCriteriaLines.map((text, index) => ({
      text,
      source: 'jira_ac' as const,
      requirementId: `${requirementPrefix}-AC-${index + 1}`,
      evidenceIds: [requirementPrefix, `AC-${index + 1}`]
    })),
    ...descriptionLines.map((text, index) => ({
      text,
      source: 'jira_desc' as const,
      requirementId: `${requirementPrefix}-DESC-${index + 1}`,
      evidenceIds: [requirementPrefix, `DESC-${index + 1}`]
    })),
    ...subtaskLines.map((text, index) => ({
      text,
      source: 'jira_linked' as const,
      requirementId: `${requirementPrefix}-LINK-${index + 1}`,
      evidenceIds: [requirementPrefix, `LINK-${index + 1}`]
    })),
    ...confluenceLines.map((text, index) => ({
      text,
      source: 'confluence' as const,
      requirementId: `${requirementPrefix}-CONF-${index + 1}`,
      evidenceIds: [requirementPrefix, `CONF-${index + 1}`]
    }))
  ];

  const seen = new Set<string>();
  const selectedSeeds = candidateSeeds.filter((seed) => {
    const normalized = seed.text.toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  }).slice(0, 6);

  return selectedSeeds.map((seed, index) => {
    const sourceAcceptanceCriteriaIds = seed.source === 'jira_ac'
      ? [`AC-${index + 1}`]
      : acceptanceCriteriaLines.length > 0
        ? acceptanceCriteriaLines.slice(0, 2).map((_, criterionIndex) => `AC-${criterionIndex + 1}`)
        : [];
    const sourceRiskLevel = seed.source === 'confluence' || seed.source === 'jira_linked'
      ? 'medium'
      : 'low';

    return {
      requirementId: seed.requirementId,
      acceptanceCriteriaIds: sourceAcceptanceCriteriaIds,
      scenarioName: toScenarioName(seed.text, rootSummary ?? requirementPrefix, index),
      scope: createScopeLabel(rootSummary, repoAnalysis),
      assertionIntentSummary: seed.text,
      functionality: pickFunctionality(seed.text || rootSummary || requirementPrefix),
      riskLevel: index === 0 ? 'medium' : sourceRiskLevel,
      riskReason: seed.source === 'user'
        ? 'User-supplied context is prioritized and must remain aligned with Jira evidence.'
        : seed.source === 'jira_ac'
          ? 'Derived directly from ticket acceptance criteria.'
          : seed.source === 'confluence'
            ? 'Confluence evidence is relevant but treated as augmentation only.'
            : 'Derived from Jira requirement context and should be reviewed before generation.',
      sourceEvidenceIds: seed.evidenceIds
    };
  });
}

function toScenarioInputs(args: PlanBundleFactoryArgs): RequirementScenarioInput[] {
  const seedSentences = splitScenarioSentences(args.userContext);
  const baseScope = args.mode === 'ticket' ? 'Ticket-driven functional validation' : 'No-ticket exploratory validation';
  const requirementPrefix = args.ticketId?.toUpperCase() ?? 'PLAN-MANUAL';

  if (seedSentences.length === 0) {
    return [
      {
        requirementId: requirementPrefix,
        acceptanceCriteriaIds: ['AC-1'],
        scenarioName: args.mode === 'ticket'
          ? `Validate ${requirementPrefix} acceptance flow`
          : 'Validate supplied manual scope',
        scope: baseScope,
        assertionIntentSummary: args.mode === 'ticket'
          ? 'Confirm acceptance criteria and essential guardrails for the provided ticket.'
          : 'Confirm manual requirements and acceptance criteria supplied in chat context.',
        functionality: 'General',
        riskLevel: 'medium',
        riskReason: 'Planning details are inferred and should be reviewed before generation.',
        sourceEvidenceIds: args.ticketId ? [args.ticketId] : ['chat_context']
      }
    ];
  }

  return seedSentences.map((sentence, index) => {
    const requirementId = `${requirementPrefix}-${index + 1}`;

    return {
      requirementId,
      acceptanceCriteriaIds: [`AC-${index + 1}`],
      scenarioName: `Scenario ${index + 1}: ${sentence.slice(0, 64)}`,
      scope: baseScope,
      assertionIntentSummary: sentence,
      functionality: pickFunctionality(sentence),
      riskLevel: index === 0 ? 'medium' : 'low',
      riskReason: index === 0
        ? 'Primary scenario anchors confidence and should be explicitly reviewed.'
        : 'Derived scenario from user context; lower risk but still reviewable.',
      sourceEvidenceIds: [`ctx_${index + 1}`]
    };
  });
}

function createRuntimePlanBundleFactory(
  runtimePlanContext: RuntimePlanContext
): (args: PlanBundleFactoryArgs) => PlanReviewBundle | undefined {
  return (args) => {
    const inputs = buildRuntimeScenarioInputs(args, runtimePlanContext);
    const records = buildScenarioPlan(inputs);
    if (records.length === 0) {
      return undefined;
    }
    return buildPlanReviewBundle(records);
  };
}

function defaultPlanBundleFactory(args: PlanBundleFactoryArgs): PlanReviewBundle | undefined {
  const inputs = toScenarioInputs(args);
  const records = buildScenarioPlan(inputs);
  if (records.length === 0) {
    return undefined;
  }

  return buildPlanReviewBundle(records);
}

function classifyFreeTextComment(text: string): ClassifiedFreeTextComment {
  const normalized = text.trim();
  const scenarioIdMatch = normalized.match(/\b(scn_[a-z0-9_]+)\b/i);
  const scenarioId = scenarioIdMatch?.[1]?.toLowerCase();
  let classification: FreeTextCommentClassification = 'clarification';

  if (/(?:\bmust\b|\bconstraint\b|\blimit\b|\bcannot\b|\bshould not\b)/i.test(normalized)) {
    classification = 'constraint';
  } else if (/(?:\bbug\b|\bfail(?:ing|ed)?\b|\berror\b|\bbroken\b|\bflaky\b)/i.test(normalized)) {
    classification = 'bug';
  } else if (/(?:\bnew\b|\badd\b|\balso\b|\binclude\b|\banother\b)/i.test(normalized)) {
    classification = 'new_context';
  }

  const target: FreeTextCommentTarget = scenarioId ? 'scenario' : 'global';

  return {
    target,
    classification,
    scenarioId,
    text: normalized
  };
}

function toMessage(mode: PlanMode, gate: ConfidenceGate): string {
  if (gate === 'reject') {
    return 'Confidence is below 40. Run is blocked until additional context is provided.';
  }

  if (gate === 'approval_required') {
    if (mode === 'ticket') {
      return 'Confidence is between 40 and 70. Review the plan carefully, then approve, reject, or cancel.';
    }
    return 'No-ticket flow confidence is between 40 and 70. Add context or explicitly approve, reject, or cancel.';
  }

  return 'Confidence is above 70. Plan is ready for explicit approval before generation can continue.';
}

function syncConfidenceGateState(
  orchestrator: PipelineOrchestrator,
  requestId: string,
  gate: ConfidenceGate
): ActionTransitionResult | undefined {
  const session = orchestrator.getSession(requestId);
  if (!session) {
    return undefined;
  }

  if (gate === 'reject') {
    return orchestrator.transition(requestId, 'cancelled', 'confidence_reject');
  }

  if (session.state === 'initialized') {
    const planningEntry = orchestrator.transition(requestId, 'awaiting_plan_approval', 'confidence_gate_entered');
    if (!planningEntry.ok) {
      return planningEntry;
    }
  }

  return undefined;
}

function shouldSuppressPlanArtifacts(
  state: PipelineState | undefined,
  stageEntryDecision?: StageEntryDecision
): boolean {
  return Boolean(stageEntryDecision && state === 'initialized');
}

function buildConfidenceContext(
  deps: ParticipantHandlerDeps,
  args: ConfidenceInputFactoryArgs
): { decision: ReturnType<typeof computeConfidenceDecision>; explainability: ConfidenceExplainability } {
  const confidenceInputFactory = deps.confidenceInputFactory ?? defaultConfidenceInputFactory;
  const profile = deps.confidenceProfile
    ?? (args.mode === 'ticket' ? DEFAULT_CONFIDENCE_PROFILE : NO_TICKET_CONFIDENCE_PROFILE);
  const confidenceInput = confidenceInputFactory(args);
  const decision = computeConfidenceDecision(confidenceInput, profile);
  const explainability = buildConfidenceExplainability(decision, confidenceInput);

  return {
    decision,
    explainability
  };
}

function buildResponse(
  requestId: string,
  mode: PlanMode,
  ticketId: string | undefined,
  userContext: string | undefined,
  warnings: string[],
  state: PipelineState | undefined,
  decision: ReturnType<typeof computeConfidenceDecision>,
  explainability: ConfidenceExplainability,
  planBundle: PlanReviewBundle | undefined,
  stageEntryDecision?: StageEntryDecision
): PlanCommandResponse {
  const suppressPlanArtifacts = shouldSuppressPlanArtifacts(state, stageEntryDecision);
  const planSummary = planBundle && !suppressPlanArtifacts ? formatPlanChatSummary(planBundle) : undefined;
  const stageEntryWarnings = stageEntryDecision
    ? stageEntryDecision.reasons.map((reason) => `${reason.code}: ${reason.message}`)
    : [];
  const responseWarnings = [...warnings, ...stageEntryWarnings];
  const resolvedActions = actionsForState(state, decision.gate);
  const message = suppressPlanArtifacts
    ? 'Planning is blocked by the internal skill integrity gate. Fix the local skill bundle and rerun `/plan`.'
    : toMessage(mode, decision.gate);

  return {
    requestId,
    mode,
    state,
    ticketId,
    message,
    userContext,
    warnings: responseWarnings,
    availableActions: suppressPlanArtifacts
      ? ['cancel']
      : resolvedActions.length > 0
        ? resolvedActions
        : CONFIDENCE_GATE_ACTIONS[decision.gate],
    confidenceScore: decision.finalScore,
    decisionGate: decision.gate,
    confidenceProfileId: decision.profileId,
    acceptsFreeText: decision.gate === 'approval_required',
    freeTextPurpose: 'additional_context_or_instruction',
    explainability,
    stageEntryDecision,
    planSummary,
    planScenarios: suppressPlanArtifacts ? undefined : planBundle?.flatScenarios
  };
}

export function handlePlanCommand(rawInput: string, deps: ParticipantHandlerDeps = {}): PlanCommandResponse {
  const now = deps.now ?? (() => new Date());
  const fallbackEventSink = deps.eventSink ?? createDefaultEventSink({ now });
  const eventSink = deps.orchestrator?.getEventSink() ?? fallbackEventSink;
  const planBundleFactory = deps.planBundleFactory ?? defaultPlanBundleFactory;

  const parseResult = parseSlashPlanInput(rawInput);
  const requestContext = buildRequestContext(parseResult, {
    requestIdFactory: deps.requestIdFactory,
    now
  });

  emitEvent(eventSink, requestContext.requestId, 'participant', 'command_received', now, {
    normalizedInput: parseResult.normalizedInput,
    mode: parseResult.mode
  });

  emitEvent(eventSink, requestContext.requestId, 'parser', 'parse_completed', now, {
    warnings: requestContext.warnings
  });

  emitEvent(eventSink, requestContext.requestId, 'bootstrap', 'context_bootstrapped', now, {
    hasUserContext: Boolean(requestContext.userContext),
    source: requestContext.userContext?.source
  });

  const userContextParts = requestContext.userContext?.text ? [requestContext.userContext.text] : [];
  const initialUserContext = joinUserContext(userContextParts);

  const { decision, explainability } = buildConfidenceContext(deps, {
    requestId: requestContext.requestId,
    mode: requestContext.mode,
    ticketId: requestContext.ticketId,
    userContext: requestContext.userContext?.text,
    warnings: requestContext.warnings,
    freeTextContext: []
  });

  emitEvent(
    eventSink,
    requestContext.requestId,
    'gate',
    'confidence_computed',
    now,
    {
      finalScore: decision.finalScore,
      thresholds: decision.thresholds
    },
    decision.profileId,
    decision.gate
  );

  REQUEST_SNAPSHOTS.set(requestContext.requestId, {
    requestId: requestContext.requestId,
    mode: requestContext.mode,
    ticketId: requestContext.ticketId,
    warnings: [...requestContext.warnings],
    userContextParts,
    confidenceProfile: deps.confidenceProfile
  });

  let stageEntryTransition: ActionTransitionResult | undefined;
  if (deps.orchestrator) {
    deps.orchestrator.startSession(requestContext.requestId, 'initialized');
    deps.orchestrator.setConfidenceDecision(requestContext.requestId, decision.profileId, decision.gate);
    stageEntryTransition = syncConfidenceGateState(deps.orchestrator, requestContext.requestId, decision.gate);
  }

  const activeSession = deps.orchestrator?.getSession(requestContext.requestId);
  const planBundle = decision.gate === 'reject'
    ? undefined
    : planBundleFactory({
        requestId: requestContext.requestId,
        mode: requestContext.mode,
        ticketId: requestContext.ticketId,
        userContext: initialUserContext,
        warnings: requestContext.warnings
      });

  if (deps.orchestrator && planBundle) {
    deps.orchestrator.seedReviewRecords(requestContext.requestId, planBundle.flatScenarios);
  }

  return buildResponse(
    requestContext.requestId,
    requestContext.mode,
    requestContext.ticketId,
    initialUserContext,
    requestContext.warnings,
    activeSession?.state,
    decision,
    explainability,
    planBundle,
    stageEntryTransition?.stageEntry
  );
}

export function handleGateFreeText(
  requestId: string,
  freeText: string,
  deps: ParticipantHandlerDeps = {}
): PlanCommandResponse {
  const snapshot = REQUEST_SNAPSHOTS.get(requestId);
  if (!snapshot) {
    throw new Error(`Unknown requestId: ${requestId}`);
  }

  const now = deps.now ?? (() => new Date());
  const fallbackEventSink = deps.eventSink ?? createDefaultEventSink({ now });
  const eventSink = deps.orchestrator?.getEventSink() ?? fallbackEventSink;
  const planBundleFactory = deps.planBundleFactory
    ?? (snapshot.runtimePlanContext ? createRuntimePlanBundleFactory(snapshot.runtimePlanContext) : defaultPlanBundleFactory);
  const confidenceProfile = deps.confidenceProfile ?? snapshot.confidenceProfile;

  const trimmed = freeText.trim();
  if (!trimmed) {
    const existingSession = deps.orchestrator?.getSession(requestId);
    const currentUserContext = joinUserContext(snapshot.userContextParts);
    const { decision, explainability } = buildConfidenceContext({
      ...deps,
      confidenceProfile
    }, {
      requestId,
      mode: snapshot.mode,
      ticketId: snapshot.ticketId,
      userContext: currentUserContext,
      warnings: snapshot.warnings,
      freeTextContext: snapshot.userContextParts
    });
    const planBundle = decision.gate === 'reject'
      ? undefined
      : planBundleFactory({
          requestId,
          mode: snapshot.mode,
          ticketId: snapshot.ticketId,
          userContext: currentUserContext,
          warnings: snapshot.warnings
        });

    return buildResponse(
      requestId,
      snapshot.mode,
      snapshot.ticketId,
      currentUserContext,
      snapshot.warnings,
      existingSession?.state,
      decision,
      explainability,
      planBundle,
      undefined
    );
  }

  snapshot.userContextParts.push(trimmed);

  emitEvent(eventSink, requestId, 'gate', 'free_text_received', now, {
    freeTextLength: trimmed.length
  });

  deps.orchestrator?.appendFreeTextContext(requestId, trimmed);
  const classifiedComment = classifyFreeTextComment(trimmed);
  if (deps.orchestrator) {
    deps.orchestrator.applyScenarioAction(requestId, {
      type: 'comment.add',
      requestId,
      source: 'chat',
      optimisticVersion: now().getTime(),
      target: classifiedComment.target,
      classification: classifiedComment.classification,
      scenarioId: classifiedComment.scenarioId,
      text: classifiedComment.text
    });
  }

  const mergedUserContext = joinUserContext(snapshot.userContextParts);
  const { decision, explainability } = buildConfidenceContext({
    ...deps,
    confidenceProfile
  }, {
    requestId,
    mode: snapshot.mode,
    ticketId: snapshot.ticketId,
    userContext: mergedUserContext,
    warnings: snapshot.warnings,
    freeTextContext: [...snapshot.userContextParts]
  });

  emitEvent(
    eventSink,
    requestId,
    'gate',
    'confidence_recomputed_from_free_text',
    now,
    {
      finalScore: decision.finalScore,
      freeTextCount: snapshot.userContextParts.length
    },
    decision.profileId,
    decision.gate
  );

  if (deps.orchestrator) {
    deps.orchestrator.setConfidenceDecision(requestId, decision.profileId, decision.gate);
    syncConfidenceGateState(deps.orchestrator, requestId, decision.gate);
  }

  const activeSession = deps.orchestrator?.getSession(requestId);
  const planBundle = decision.gate === 'reject'
    ? undefined
    : planBundleFactory({
        requestId,
        mode: snapshot.mode,
        ticketId: snapshot.ticketId,
        userContext: mergedUserContext,
        warnings: snapshot.warnings
      });

  return buildResponse(
    requestId,
    snapshot.mode,
    snapshot.ticketId,
    mergedUserContext,
    snapshot.warnings,
    activeSession?.state,
    decision,
    explainability,
    planBundle,
    undefined
  );
}

export function handlePreviewApproveAll(
  requestId: string,
  previewVersion: string,
  deps: ParticipantHandlerDeps = {}
): ActionTransitionResult {
  const orchestrator = deps.orchestrator;
  if (!orchestrator) {
    return {
      ok: false,
      requestId,
      from: 'initialized',
      errorCode: 'UNKNOWN_REQUEST'
    };
  }

  const now = deps.now ?? (() => new Date());
  const action = createPreviewApproveAllAction(
    requestId,
    now().getTime(),
    'chat',
    previewVersion
  );

  return orchestrator.applyPreviewAction(requestId, action);
}

export function handleGuardrailDecision(
  requestId: string,
  action: QuickAction,
  comment: string | undefined,
  deps: ParticipantHandlerDeps = {}
): ActionTransitionResult {
  const orchestrator = deps.orchestrator;
  if (!orchestrator) {
    return {
      ok: false,
      requestId,
      from: 'initialized',
      errorCode: 'UNKNOWN_REQUEST'
    };
  }

  return orchestrator.applyGuardrailDecision(requestId, action, comment);
}

export async function handleExecutionRunRequest(
  requestId: string,
  options: ExecuteScopedRunOptions = {},
  deps: ParticipantHandlerDeps = {}
): Promise<ExecutionRunResult> {
  const orchestrator = deps.orchestrator;
  if (!orchestrator) {
    return {
      ok: false,
      requestId,
      from: 'initialized',
      errorCode: 'UNKNOWN_REQUEST'
    };
  }

  return orchestrator.executeScopedRun(requestId, options);
}

export async function handleExecutionGuardrailDecision(
  requestId: string,
  action: QuickAction,
  comment: string | undefined,
  deps: ParticipantHandlerDeps = {}
): Promise<ActionTransitionResult | ExecutionRunResult> {
  const orchestrator = deps.orchestrator;
  if (!orchestrator) {
    return {
      ok: false,
      requestId,
      from: 'initialized',
      errorCode: 'UNKNOWN_REQUEST'
    };
  }

  return orchestrator.applyExecutionGuardrailDecision(
    requestId,
    action,
    comment,
    deps.executionRunOptions
  );
}

export function createParticipantRequestHandler(deps: ParticipantHandlerDeps = {}) {
  function resolveRawInput(firstArg: unknown): string {
    if (typeof firstArg === 'string') {
      return firstArg;
    }

    if (isChatRequestLike(firstArg)) {
      const prompt = firstArg.prompt.trim();
      return prompt.length > 0 ? prompt : '/plan';
    }

    return '/plan';
  }

  function formatResponseMarkdown(response: PlanCommandResponse): string {
    const lines: string[] = [
      '## PlaywrightAgent',
      '',
      `Request ID: \`${response.requestId}\``,
      `Mode: \`${response.mode}\``,
      `Confidence: \`${response.confidenceScore}\` (\`${response.decisionGate}\`)`,
      '',
      response.message
    ];

    if (response.ticketId) {
      lines.push('', `Ticket: \`${response.ticketId}\``);
    }

    if (response.userContext?.trim()) {
      lines.push('', '### Context', response.userContext.trim());
    }

    if (response.warnings.length > 0) {
      lines.push('', '### Warnings');
      for (const warning of response.warnings) {
        lines.push(`- ${warning}`);
      }
    }

    lines.push('', '### Confidence Breakdown');
    lines.push(`- repo: \`${response.explainability.componentScores.repo}\``);
    lines.push(`- jira: \`${response.explainability.componentScores.jira}\``);
    lines.push(`- confluence: \`${response.explainability.componentScores.confluence}\``);
    lines.push(`- user_context: \`${response.explainability.componentScores.user_context}\``);

    if (response.explainability.reasons.length > 0) {
      lines.push('', '### Context Signals');
      for (const reason of response.explainability.reasons) {
        lines.push(`- ${reason}`);
      }
    }

    if (response.planSummary) {
      lines.push('', response.planSummary);
    }

    if (response.availableActions.length > 0) {
      lines.push(
        '',
        `Awaiting action: ${response.availableActions.map((action) => `\`${action}\``).join(', ')}`
      );
    }

    return lines.join('\n');
  }

  return async (...args: unknown[]): Promise<PlanCommandResponse | { metadata: { playwrightAgent: { requestId: string; availableActions: readonly QuickAction[]; mode?: PlanMode; decisionGate?: ConfidenceGate; state?: PipelineState } } }> => {
    const firstArg = args[0];
    const contextArg = args[1];
    const streamArg = args[2];
    const rawInput = resolveRawInput(firstArg).trim();
    const latestContext = extractLatestActionContext(contextArg);

    if (isChatRequestLike(firstArg) && isQuickAction(rawInput.toLowerCase())) {
      const action = rawInput.toLowerCase() as QuickAction;
      const stream = isChatResponseStreamLike(streamArg) ? streamArg : undefined;

      const fallbackRequestId = getLastKnownRequestId();
      const effectiveRequestId = latestContext?.requestId ?? fallbackRequestId;

      if (!deps.orchestrator || !effectiveRequestId) {
        stream?.markdown('No active gated request found for this action. Start with `/plan` first.');
        return buildChatResultMetadata('none', []);
      }

      const fallbackSession = deps.orchestrator.getSession(effectiveRequestId);
      const sessionActions = actionsForState(fallbackSession?.state, fallbackSession?.decisionGate);
      const inferredActions = sessionActions.length > 0
        ? sessionActions
        : latestContext?.availableActions?.length
          ? latestContext.availableActions
          : [];

      if (fallbackSession?.state === 'cancelled' && action === 'cancel') {
        stream?.markdown('Request is already cancelled. Start a new run with `/plan` when ready.');
        return buildChatResultMetadata(
          effectiveRequestId,
          [],
          undefined,
          fallbackSession.decisionGate,
          fallbackSession.state
        );
      }

      if (inferredActions.length > 0 && !inferredActions.includes(action)) {
        stream?.markdown(
          `Action \`${action}\` is not available now. Allowed: ${inferredActions.map((item) => `\`${item}\``).join(', ')}`
        );
        return buildChatResultMetadata(effectiveRequestId, inferredActions);
      }

      const transition = deps.orchestrator.handleQuickAction(effectiveRequestId, action);
      const session = deps.orchestrator.getSession(effectiveRequestId);
      const nextActions = actionsForState(session?.state, session?.decisionGate);

      if (!transition.ok) {
        stream?.markdown(
          `Action \`${action}\` failed (\`${transition.errorCode ?? 'unknown'}\`). Current state: \`${session?.state ?? transition.from}\`.`
        );
        return buildChatResultMetadata(
          effectiveRequestId,
          nextActions,
          undefined,
          session?.decisionGate,
          session?.state
        );
      }

      stream?.markdown(
        [
          `Action \`${action}\` applied.`,
          `State: \`${transition.from}\` → \`${transition.to ?? session?.state ?? transition.from}\`.`,
          nextActions.length > 0
            ? `Next actions: ${nextActions.map((item) => `\`${item}\``).join(', ')}`
            : 'No further quick actions available in current state.'
        ].join('\n')
      );

      return buildChatResultMetadata(
        effectiveRequestId,
        nextActions,
        undefined,
        session?.decisionGate,
        session?.state
      );
    }

    const effectiveRequestId = latestContext?.requestId ?? getLastKnownRequestId();
    const existingSnapshot = effectiveRequestId ? REQUEST_SNAPSHOTS.get(effectiveRequestId) : undefined;
    const activeSession = effectiveRequestId && deps.orchestrator
      ? deps.orchestrator.getSession(effectiveRequestId)
      : undefined;
    const shouldTreatAsFreeText = isChatRequestLike(firstArg)
      && !rawInput.startsWith('/plan')
      && rawInput.length > 0
      && !isQuickAction(rawInput.toLowerCase())
      && existingSnapshot
      && activeSession
      && activeSession.state !== 'cancelled';

    if (shouldTreatAsFreeText && effectiveRequestId) {
      const response = handleGateFreeText(effectiveRequestId, rawInput, {
        ...deps,
        confidenceProfile: existingSnapshot.confidenceProfile ?? deps.confidenceProfile,
        planBundleFactory: existingSnapshot.runtimePlanContext
          ? createRuntimePlanBundleFactory(existingSnapshot.runtimePlanContext)
          : deps.planBundleFactory
      });

      if (existingSnapshot.messageOverride && response.decisionGate === 'reject') {
        response.message = existingSnapshot.messageOverride;
      }

      if (isChatResponseStreamLike(streamArg) && isChatRequestLike(firstArg)) {
        streamArg.markdown(formatResponseMarkdown(response));
        return buildChatResultMetadata(
          response.requestId,
          response.availableActions,
          response.mode,
          response.decisionGate,
          response.state,
          response
        );
      }

      if (isChatResponseStreamLike(streamArg)) {
        streamArg.markdown(formatResponseMarkdown(response));
      }

      return response;
    }

    const runtimeConfidence = await buildRuntimeConfidenceContext(rawInput, deps);
    const response = handlePlanCommand(rawInput, {
      ...deps,
      confidenceProfile: runtimeConfidence?.confidenceProfile ?? deps.confidenceProfile,
      planBundleFactory: runtimeConfidence?.runtimePlanContext
        ? createRuntimePlanBundleFactory(runtimeConfidence.runtimePlanContext)
        : deps.planBundleFactory,
      confidenceInputFactory: runtimeConfidence
        ? () => runtimeConfidence.confidenceInput
        : deps.confidenceInputFactory
    });

    if (runtimeConfidence?.warnings.length) {
      appendUnique(response.warnings, runtimeConfidence.warnings);
    }
    if (runtimeConfidence?.messageOverride && response.decisionGate === 'reject') {
      response.message = runtimeConfidence.messageOverride;
    }
    if (runtimeConfidence?.runtimePlanContext || runtimeConfidence?.confidenceProfile || runtimeConfidence?.messageOverride) {
      patchRequestSnapshot(response.requestId, {
        runtimePlanContext: runtimeConfidence?.runtimePlanContext,
        confidenceProfile: runtimeConfidence?.confidenceProfile,
        messageOverride: runtimeConfidence?.messageOverride
      });
    }

    if (isChatResponseStreamLike(streamArg) && isChatRequestLike(firstArg)) {
      streamArg.markdown(formatResponseMarkdown(response));
      return buildChatResultMetadata(
        response.requestId,
        response.availableActions,
        response.mode,
        response.decisionGate,
        response.state,
        response
      );
    }

    if (isChatResponseStreamLike(streamArg)) {
      streamArg.markdown(formatResponseMarkdown(response));
    }

    return response;
  };
}

export function getRequestSnapshot(requestId: string): Readonly<RequestSnapshot> | undefined {
  return REQUEST_SNAPSHOTS.get(requestId);
}
