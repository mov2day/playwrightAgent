import type { QuickAction } from '../participant/actions';
import type { PipelineState } from '../pipeline/stateMachine';
import type { PlanReviewBundle, ScenarioApprovalState, ScenarioPlanRecord } from '../pipeline/planning/planContracts';

export type ReviewTabId = 'all' | 'by_requirement' | 'by_acceptance_criteria' | 'by_functionality' | 'rejected';

export interface ReviewCommentEntry {
  commentId: string;
  target: 'scenario' | 'global';
  classification: 'clarification' | 'constraint' | 'bug' | 'new_context';
  text: string;
  createdAt: string;
}

export interface ReviewScenarioView {
  scenarioId: string;
  scenarioName: string;
  scope: string;
  assertionIntentSummary: string;
  primaryRequirementId: string;
  acceptanceCriteriaIds: string[];
  riskLevel: ScenarioPlanRecord['riskLevel'];
  riskReason: string;
  mitigation?: string;
  functionality: string;
  approvalState: ScenarioApprovalState;
  revisionReason: string[];
  comments: ReviewCommentEntry[];
}

export interface ReviewGroupView {
  groupId: string;
  label: string;
  scenarioIds: string[];
  count: number;
}

export interface ReviewTabView {
  tabId: 'all' | 'by_requirement' | 'by_acceptance_criteria' | 'by_functionality' | 'rejected';
  label: string;
  count: number;
  groups: ReviewGroupView[];
}

export interface ReviewViewModel {
  requestId: string;
  state: PipelineState;
  tabs: ReviewTabView[];
  activeTabId: ReviewTabId;
  scenariosById: Record<string, ReviewScenarioView>;
  orderedScenarioIds: string[];
  globalComments: ReviewCommentEntry[];
  availableActions: readonly QuickAction[];
}

export interface BuildReviewViewModelInput {
  requestId: string;
  state: PipelineState;
  bundle: PlanReviewBundle;
  availableActions: readonly QuickAction[];
  activeTabId?: ReviewTabId;
  globalComments?: ReviewCommentEntry[];
}

export function sanitizeReviewText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .trim()
    .slice(0, 400);
}

function toReviewScenario(record: ScenarioPlanRecord): ReviewScenarioView {
  return {
    scenarioId: record.scenarioId,
    scenarioName: sanitizeReviewText(record.scenarioName),
    scope: sanitizeReviewText(record.scope),
    assertionIntentSummary: sanitizeReviewText(record.assertionIntentSummary),
    primaryRequirementId: sanitizeReviewText(record.primaryRequirementId),
    acceptanceCriteriaIds: record.acceptanceCriteriaIds.map((item) => sanitizeReviewText(item)),
    riskLevel: record.riskLevel,
    riskReason: sanitizeReviewText(record.riskReason),
    mitigation: record.mitigation ? sanitizeReviewText(record.mitigation) : undefined,
    functionality: sanitizeReviewText(record.functionality),
    approvalState: record.approvalState,
    revisionReason: record.revisionReason.map((item) => sanitizeReviewText(item)),
    comments: record.commentRefs.map((commentRef) => ({
      commentId: commentRef.commentId,
      target: commentRef.target,
      classification: commentRef.classification ?? 'clarification',
      text: sanitizeReviewText(commentRef.text ?? ''),
      createdAt: commentRef.createdAt ?? ''
    }))
  };
}

function toGroupViews(source: Record<string, string[]>): ReviewGroupView[] {
  return Object.entries(source)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupId, scenarioIds]) => ({
      groupId,
      label: groupId,
      scenarioIds,
      count: scenarioIds.length
    }));
}

function toReviewCommentEntry(comment: ReviewCommentEntry): ReviewCommentEntry {
  return {
    ...comment,
    text: sanitizeReviewText(comment.text)
  };
}

function buildTabs(bundle: PlanReviewBundle): ReviewTabView[] {
  return [
    {
      tabId: 'all',
      label: 'All',
      count: bundle.flatScenarios.length,
      groups: [
        {
          groupId: 'all',
          label: 'All scenarios',
          scenarioIds: bundle.flatScenarios.map((scenario) => scenario.scenarioId),
          count: bundle.flatScenarios.length
        }
      ]
    },
    {
      tabId: 'by_requirement',
      label: 'By Requirement',
      count: Object.keys(bundle.groupIndexes.byRequirementId).length,
      groups: toGroupViews(bundle.groupIndexes.byRequirementId)
    },
    {
      tabId: 'by_acceptance_criteria',
      label: 'By Acceptance Criteria',
      count: Object.keys(bundle.groupIndexes.byAcceptanceCriteriaId).length,
      groups: toGroupViews(bundle.groupIndexes.byAcceptanceCriteriaId)
    },
    {
      tabId: 'by_functionality',
      label: 'By Functionality',
      count: Object.keys(bundle.groupIndexes.byFunctionality).length,
      groups: toGroupViews(bundle.groupIndexes.byFunctionality)
    },
    {
      tabId: 'rejected',
      label: 'Rejected',
      count: bundle.groupIndexes.rejectedScenarioIds.length,
      groups: [
        {
          groupId: 'rejected',
          label: 'Rejected scenarios',
          scenarioIds: [...bundle.groupIndexes.rejectedScenarioIds],
          count: bundle.groupIndexes.rejectedScenarioIds.length
        }
      ]
    }
  ];
}

export function buildReviewViewModel(input: BuildReviewViewModelInput): ReviewViewModel {
  const scenariosById = Object.fromEntries(
    input.bundle.flatScenarios.map((record) => [record.scenarioId, toReviewScenario(record)])
  );

  const orderedScenarioIds = input.bundle.flatScenarios.map((record) => record.scenarioId);

  return {
    requestId: input.requestId,
    state: input.state,
    tabs: buildTabs(input.bundle),
    activeTabId: input.activeTabId ?? 'all',
    scenariosById,
    orderedScenarioIds,
    globalComments: input.globalComments ? input.globalComments.map(toReviewCommentEntry) : [],
    availableActions: input.availableActions
  };
}
