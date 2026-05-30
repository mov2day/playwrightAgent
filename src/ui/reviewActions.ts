import type { ReviewCommentEntry } from './reviewModel';

export type ReviewActionSource = 'chat' | 'webview' | 'system';

interface ReviewActionBase {
  requestId: string;
  source: ReviewActionSource;
  optimisticVersion: number;
}

export interface ScenarioApproveAction extends ReviewActionBase {
  type: 'scenario.approve';
  scenarioId: string;
}

export interface ScenarioRejectAction extends ReviewActionBase {
  type: 'scenario.reject';
  scenarioId: string;
  reason?: string;
}

export interface ScenarioReviseAction extends ReviewActionBase {
  type: 'scenario.revise';
  scenarioId: string;
  reason: string;
}

export interface BulkApproveAction extends ReviewActionBase {
  type: 'bulk.approve';
  mode: 'pending_only' | 'force_override';
}

export interface BulkRejectAction extends ReviewActionBase {
  type: 'bulk.reject';
  mode: 'pending_only' | 'force_override';
  reason?: string;
}

export interface CommentAddAction extends ReviewActionBase {
  type: 'comment.add';
  target: 'scenario' | 'global';
  classification: 'clarification' | 'constraint' | 'bug' | 'new_context';
  scenarioId?: string;
  text: string;
}

export interface SessionContinueAction extends ReviewActionBase {
  type: 'session.continue';
}

export interface SessionCancelAction extends ReviewActionBase {
  type: 'session.cancel';
}

export type ReviewActionEnvelope =
  | ScenarioApproveAction
  | ScenarioRejectAction
  | ScenarioReviseAction
  | BulkApproveAction
  | BulkRejectAction
  | CommentAddAction
  | SessionContinueAction
  | SessionCancelAction;

export interface ReviewActionAck {
  requestId: string;
  optimisticVersion: number;
  ackVersion: number;
  accepted: boolean;
  action: ReviewActionEnvelope;
}

const ACTION_TYPES = new Set<string>([
  'scenario.approve',
  'scenario.reject',
  'scenario.revise',
  'bulk.approve',
  'bulk.reject',
  'comment.add',
  'session.continue',
  'session.cancel'
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isReviewActionEnvelope(value: unknown): value is ReviewActionEnvelope {
  if (!isObject(value)) {
    return false;
  }

  if (!hasString(value.type) || !ACTION_TYPES.has(value.type)) {
    return false;
  }

  if (!hasString(value.requestId) || !hasString(value.source) || !hasNumber(value.optimisticVersion)) {
    return false;
  }

  if ((value.type === 'bulk.approve' || value.type === 'bulk.reject')
    && value.mode !== 'pending_only'
    && value.mode !== 'force_override') {
    return false;
  }

  if ((value.type === 'scenario.approve'
    || value.type === 'scenario.reject'
    || value.type === 'scenario.revise')
    && !hasString(value.scenarioId)) {
    return false;
  }

  if (value.type === 'scenario.revise' && !hasString(value.reason)) {
    return false;
  }

  if (value.type === 'comment.add') {
    if ((value.target !== 'scenario' && value.target !== 'global')
      || (value.classification !== 'clarification'
        && value.classification !== 'constraint'
        && value.classification !== 'bug'
        && value.classification !== 'new_context')
      || !hasString(value.text)) {
      return false;
    }
  }

  return true;
}

export function createBulkApproveAction(
  requestId: string,
  optimisticVersion: number,
  source: ReviewActionSource = 'webview',
  mode: 'pending_only' | 'force_override' = 'pending_only'
): BulkApproveAction {
  return {
    type: 'bulk.approve',
    requestId,
    source,
    optimisticVersion,
    mode
  };
}

export function createBulkRejectAction(
  requestId: string,
  optimisticVersion: number,
  source: ReviewActionSource = 'webview',
  mode: 'pending_only' | 'force_override' = 'pending_only',
  reason?: string
): BulkRejectAction {
  return {
    type: 'bulk.reject',
    requestId,
    source,
    optimisticVersion,
    mode,
    reason
  };
}

export function createCommentFromAction(action: CommentAddAction): ReviewCommentEntry {
  return {
    commentId: `${action.requestId}_${action.optimisticVersion}`,
    target: action.target,
    classification: action.classification,
    text: action.text,
    createdAt: new Date().toISOString()
  };
}
