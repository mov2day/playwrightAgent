import type { EventSink } from '../adapters/eventSink';
import { QUICK_ACTIONS, type QuickAction } from '../participant/actions';
import type { ReviewActionEnvelope } from '../ui/reviewActions';
import type { ConfidenceGate } from './confidence/confidenceContracts';
import { createPipelineEvent } from './events';
import { computeApprovedScope, computeRegenerationTargets, type ApprovalScopeRecord, type RevisionCommentInput } from './planning/approvalScope';
import type { ScenarioPlanRecord } from './planning/planContracts';
import { buildSkillManifest } from './skills/manifestBuilder';
import {
  evaluateSkillQualityGate,
  type SkillGateStage,
  type SkillQualityGateReason,
  type SkillQualityGateResult
} from './skills/qualityGate';
import type { PipelineState, TransitionResult } from './stateMachine';
import { transitionState } from './stateMachine';

const PRE_STAGE_ENTRY_BY_TARGET_STATE: Partial<Record<PipelineState, SkillGateStage>> = {
  awaiting_plan_approval: 'planning',
  awaiting_script_approval: 'generation',
  ready_to_write: 'preview',
  completed: 'write'
};

const STAGE_ENTRY_ACTIONS: readonly QuickAction[] = QUICK_ACTIONS;

function buildFailClosedManifestUnavailable(stage: SkillGateStage, message: string): SkillQualityGateResult {
  return {
    stage,
    blocked: true,
    fail_closed: true,
    requires_user_decision: true,
    reasons: [{
      code: 'manifest_unavailable',
      check: 'manifest',
      message
    }]
  };
}

export interface ReviewCommentRecord {
  commentId: string;
  target: 'scenario' | 'global';
  classification: 'clarification' | 'constraint' | 'bug' | 'new_context';
  text: string;
  createdAt: string;
}

export interface ScenarioReviewRecord {
  scenarioId: string;
  primaryRequirementId: string;
  acceptanceCriteriaIds: string[];
  approvalState: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  revisionReason: string[];
  comments: ReviewCommentRecord[];
  updatedAt: string;
  updatedBy: 'chat' | 'webview' | 'system';
}

export interface ReviewHistoryEntry {
  requestId: string;
  actionType: ReviewActionEnvelope['type'];
  scenarioId?: string;
  source: 'chat' | 'webview' | 'system';
  reason?: string;
  timestamp: string;
}

interface PipelineSession {
  requestId: string;
  state: PipelineState;
  createdAt: string;
  updatedAt: string;
  confidenceProfileId?: string;
  decisionGate?: ConfidenceGate;
  freeTextContext: string[];
  reviewRecordsByScenarioId: Record<string, ScenarioReviewRecord>;
  revisionHistory: ReviewHistoryEntry[];
  globalComments: ReviewCommentRecord[];
  lastAckVersion: number;
}

export interface ReviewSnapshot {
  requestId: string;
  ackVersion: number;
  approvedScenarioIds: string[];
  excludedScenarioIds: string[];
  approvedCount: number;
  excludedCount: number;
  regenerationScenarioIds: string[];
  impactedRequirementIds: string[];
  records: Record<string, ScenarioReviewRecord>;
}

export interface OrchestratorDeps {
  eventSink: EventSink;
  now?: () => Date;
  rootDir?: string;
  stageEntryGateEvaluator?: StageEntryGateEvaluator;
}

export interface StageEntryDecision {
  stage: SkillGateStage;
  blocked: boolean;
  fail_closed: boolean;
  requires_user_decision: boolean;
  reasons: SkillQualityGateReason[];
  availableActions: readonly QuickAction[];
  manifest_hash?: string;
}

export interface ActionTransitionResult {
  ok: boolean;
  requestId: string;
  from: PipelineState;
  to?: PipelineState;
  errorCode?: 'UNKNOWN_REQUEST' | 'UNMAPPED_ACTION' | 'ILLEGAL_TRANSITION' | 'STAGE_ENTRY_BLOCKED';
  stageEntry?: StageEntryDecision;
}

export interface ReviewActionResult extends ActionTransitionResult {
  ackVersion?: number;
  reviewSnapshot?: ReviewSnapshot;
}

export type StageEntryGateEvaluator = (stage: SkillGateStage) => SkillQualityGateResult;

function toScopeRecord(record: ScenarioReviewRecord): ApprovalScopeRecord {
  return {
    scenarioId: record.scenarioId,
    primaryRequirementId: record.primaryRequirementId,
    acceptanceCriteriaIds: [...record.acceptanceCriteriaIds],
    approvalState: record.approvalState
  };
}

function toRevisionComment(record: ReviewCommentRecord, scenarioId?: string): RevisionCommentInput {
  return {
    target: record.target,
    classification: record.classification,
    text: record.text,
    scenarioId
  };
}

function cloneScenarioRecord(record: ScenarioReviewRecord): ScenarioReviewRecord {
  return {
    ...record,
    acceptanceCriteriaIds: [...record.acceptanceCriteriaIds],
    revisionReason: [...record.revisionReason],
    comments: [...record.comments]
  };
}

function sanitizeReason(reason: string | undefined): string | undefined {
  const normalized = reason?.trim();
  return normalized ? normalized.slice(0, 400) : undefined;
}

export class PipelineOrchestrator {
  private readonly sessions = new Map<string, PipelineSession>();

  private readonly eventSink: EventSink;

  private readonly now: () => Date;

  private readonly rootDir: string;

  private readonly stageEntryGateEvaluator: StageEntryGateEvaluator;

  constructor(deps: OrchestratorDeps) {
    this.eventSink = deps.eventSink;
    this.now = deps.now ?? (() => new Date());
    this.rootDir = deps.rootDir ?? process.cwd();
    this.stageEntryGateEvaluator = deps.stageEntryGateEvaluator ?? ((stage) => {
      try {
        const manifest = buildSkillManifest({ rootDir: this.rootDir });
        return evaluateSkillQualityGate(manifest, stage);
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Skill manifest build failed unexpectedly.';
        return buildFailClosedManifestUnavailable(stage, message);
      }
    });
  }

  startSession(requestId: string, initialState: PipelineState = 'initialized'): PipelineSession {
    const timestamp = this.now().toISOString();
    const session: PipelineSession = {
      requestId,
      state: initialState,
      createdAt: timestamp,
      updatedAt: timestamp,
      freeTextContext: [],
      reviewRecordsByScenarioId: {},
      revisionHistory: [],
      globalComments: [],
      lastAckVersion: 0
    };

    this.sessions.set(requestId, session);
    this.emit(requestId, 'orchestrator', 'session_started', initialState);
    return session;
  }

  getSession(requestId: string): PipelineSession | undefined {
    return this.sessions.get(requestId);
  }

  seedReviewRecords(requestId: string, scenarios: readonly ScenarioPlanRecord[]): boolean {
    const session = this.sessions.get(requestId);
    if (!session) {
      return false;
    }

    const nowIso = this.now().toISOString();
    const seeded: Record<string, ScenarioReviewRecord> = {};

    for (const scenario of scenarios) {
      const existing = session.reviewRecordsByScenarioId[scenario.scenarioId];

      seeded[scenario.scenarioId] = {
        scenarioId: scenario.scenarioId,
        primaryRequirementId: scenario.primaryRequirementId,
        acceptanceCriteriaIds: [...scenario.acceptanceCriteriaIds],
        approvalState: existing?.approvalState ?? scenario.approvalState,
        revisionReason: existing ? [...existing.revisionReason] : [...scenario.revisionReason],
        comments: existing ? [...existing.comments] : [],
        updatedAt: existing?.updatedAt ?? nowIso,
        updatedBy: existing?.updatedBy ?? 'system'
      };
    }

    session.reviewRecordsByScenarioId = seeded;
    session.updatedAt = nowIso;

    this.emit(requestId, 'ui', 'review_records_seeded', session.state, {
      scenarioCount: scenarios.length
    }, session.confidenceProfileId, session.decisionGate);

    return true;
  }

  getReviewSnapshot(requestId: string): ReviewSnapshot | undefined {
    const session = this.sessions.get(requestId);
    if (!session) {
      return undefined;
    }

    return this.buildReviewSnapshot(session);
  }

  setConfidenceDecision(
    requestId: string,
    confidenceProfileId: string,
    decisionGate: ConfidenceGate
  ): void {
    const session = this.sessions.get(requestId);
    if (!session) {
      return;
    }

    session.confidenceProfileId = confidenceProfileId;
    session.decisionGate = decisionGate;
    session.updatedAt = this.now().toISOString();

    this.emit(requestId, 'gate', 'confidence_decision_recorded', session.state, {
      confidenceProfileId,
      decisionGate
    }, confidenceProfileId, decisionGate);
  }

  appendFreeTextContext(requestId: string, text: string): boolean {
    const session = this.sessions.get(requestId);
    if (!session) {
      return false;
    }

    const normalized = text.trim();
    if (!normalized) {
      return false;
    }

    session.freeTextContext.push(normalized);
    session.updatedAt = this.now().toISOString();

    this.emit(requestId, 'gate', 'free_text_appended', session.state, {
      appendedLength: normalized.length,
      freeTextCount: session.freeTextContext.length
    }, session.confidenceProfileId, session.decisionGate);
    return true;
  }

  transition(requestId: string, to: PipelineState, action: string): ActionTransitionResult {
    const session = this.sessions.get(requestId);
    if (!session) {
      return {
        ok: false,
        requestId,
        from: 'initialized',
        errorCode: 'UNKNOWN_REQUEST'
      };
    }

    const transition = transitionState(session.state, to);
    if (!transition.ok) {
      this.emit(requestId, 'gate', 'transition_blocked', session.state, {
        attempted: to,
        action,
        errorCode: transition.errorCode
      });

      return {
        ok: false,
        requestId,
        from: session.state,
        errorCode: transition.errorCode
      };
    }

    const preStage = PRE_STAGE_ENTRY_BY_TARGET_STATE[to];
    if (preStage) {
      const stageEntry = this.evaluatePreStageGuard(preStage);
      if (stageEntry.blocked || stageEntry.fail_closed || stageEntry.requires_user_decision) {
        this.emit(requestId, 'gate', 'stage_entry_blocked', session.state, {
          stage: stageEntry.stage,
          blocked: stageEntry.blocked,
          fail_closed: stageEntry.fail_closed,
          requires_user_decision: stageEntry.requires_user_decision,
          reasonCodes: stageEntry.reasons.map((reason) => reason.code),
          action
        });

        return {
          ok: false,
          requestId,
          from: session.state,
          errorCode: 'STAGE_ENTRY_BLOCKED',
          stageEntry
        };
      }

      this.emit(requestId, 'gate', 'stage_entry_allowed', session.state, {
        stage: stageEntry.stage,
        blocked: stageEntry.blocked,
        fail_closed: stageEntry.fail_closed,
        requires_user_decision: stageEntry.requires_user_decision,
        manifest_hash: stageEntry.manifest_hash,
        action
      });
    }

    session.state = to;
    session.updatedAt = this.now().toISOString();

    this.emit(requestId, 'gate', 'transition_applied', session.state, {
      from: transition.from,
      to: transition.to,
      action
    });

    return {
      ok: true,
      requestId,
      from: transition.from,
      to: transition.to
    };
  }

  handleQuickAction(requestId: string, action: QuickAction): ActionTransitionResult {
    const session = this.sessions.get(requestId);
    if (!session) {
      return {
        ok: false,
        requestId,
        from: 'initialized',
        errorCode: 'UNKNOWN_REQUEST'
      };
    }

    let targetState: PipelineState | undefined;

    if (action === 'cancel') {
      targetState = 'cancelled';
    } else if (action === 'approve') {
      if (session.state === 'awaiting_plan_approval') {
        targetState = 'plan_approved';
      } else if (session.state === 'awaiting_script_approval') {
        targetState = 'script_approved';
      }
    } else if (action === 'reject') {
      if (session.state === 'awaiting_plan_approval') {
        targetState = 'plan_rejected';
      } else if (session.state === 'awaiting_script_approval') {
        targetState = 'script_rejected';
      }
    } else if (action === 'continue') {
      if (session.state === 'awaiting_plan_approval' && session.decisionGate === 'approval_required') {
        targetState = 'plan_approved';
      } else if (session.state === 'plan_approved') {
        targetState = 'awaiting_script_approval';
      } else if (session.state === 'script_approved') {
        targetState = 'ready_to_write';
      }
    }

    if (!targetState) {
      this.emit(requestId, 'gate', 'quick_action_unmapped', session.state, {
        action
      });
      return {
        ok: false,
        requestId,
        from: session.state,
        errorCode: 'UNMAPPED_ACTION'
      };
    }

    return this.transition(requestId, targetState, action);
  }

  private evaluatePreStageGuard(stage: SkillGateStage): StageEntryDecision {
    const gateResult = this.stageEntryGateEvaluator(stage);
    return {
      stage,
      blocked: gateResult.blocked,
      fail_closed: gateResult.fail_closed,
      requires_user_decision: gateResult.requires_user_decision,
      reasons: [...gateResult.reasons],
      availableActions: [...STAGE_ENTRY_ACTIONS],
      manifest_hash: gateResult.manifest_hash
    };
  }

  applyScenarioAction(requestId: string, action: ReviewActionEnvelope): ReviewActionResult {
    const session = this.sessions.get(requestId);
    if (!session) {
      return {
        ok: false,
        requestId,
        from: 'initialized',
        errorCode: 'UNKNOWN_REQUEST'
      };
    }

    if (action.requestId !== requestId) {
      return {
        ok: false,
        requestId,
        from: session.state,
        errorCode: 'UNMAPPED_ACTION'
      };
    }

    if (action.type === 'session.continue') {
      const result = this.handleQuickAction(requestId, 'continue');
      return {
        ...result,
        ackVersion: session.lastAckVersion,
        reviewSnapshot: this.buildReviewSnapshot(session)
      };
    }

    if (action.type === 'session.cancel') {
      const result = this.handleQuickAction(requestId, 'cancel');
      return {
        ...result,
        ackVersion: session.lastAckVersion,
        reviewSnapshot: this.buildReviewSnapshot(session)
      };
    }

    const nowIso = this.now().toISOString();

    if (action.type === 'scenario.approve' || action.type === 'scenario.reject' || action.type === 'scenario.revise') {
      const current = session.reviewRecordsByScenarioId[action.scenarioId] ?? {
        scenarioId: action.scenarioId,
        primaryRequirementId: 'UNMAPPED',
        acceptanceCriteriaIds: [],
        approvalState: 'pending',
        revisionReason: [],
        comments: [],
        updatedAt: nowIso,
        updatedBy: 'system'
      };

      const next = cloneScenarioRecord(current);

      if (action.type === 'scenario.approve') {
        next.approvalState = 'approved';
      }

      if (action.type === 'scenario.reject') {
        next.approvalState = 'needs_revision';
        const reason = sanitizeReason(action.reason) ?? 'Scenario rejected by reviewer.';
        if (!next.revisionReason.includes(reason)) {
          next.revisionReason.push(reason);
        }
      }

      if (action.type === 'scenario.revise') {
        next.approvalState = 'needs_revision';
        const reason = sanitizeReason(action.reason) ?? 'Scenario marked for revision.';
        if (!next.revisionReason.includes(reason)) {
          next.revisionReason.push(reason);
        }
      }

      next.updatedAt = nowIso;
      next.updatedBy = action.source;
      session.reviewRecordsByScenarioId[action.scenarioId] = next;

      session.revisionHistory.push({
        requestId,
        actionType: action.type,
        scenarioId: action.scenarioId,
        source: action.source,
        reason: action.type === 'scenario.approve' ? undefined : sanitizeReason(action.reason),
        timestamp: nowIso
      });
    }

    if (action.type === 'bulk.approve' || action.type === 'bulk.reject') {
      const records = Object.values(session.reviewRecordsByScenarioId);
      const mode: 'pending_only' | 'force_override' = action.mode;

      for (const record of records) {
        const shouldMutate = mode === 'force_override' || record.approvalState === 'pending';
        if (!shouldMutate) {
          continue;
        }

        const next = cloneScenarioRecord(record);
        if (action.type === 'bulk.approve') {
          next.approvalState = 'approved';
        } else {
          next.approvalState = 'needs_revision';
          const reason = sanitizeReason(action.reason) ?? 'Bulk rejection requested.';
          if (!next.revisionReason.includes(reason)) {
            next.revisionReason.push(reason);
          }
        }

        next.updatedAt = nowIso;
        next.updatedBy = action.source;
        session.reviewRecordsByScenarioId[next.scenarioId] = next;
      }

      session.revisionHistory.push({
        requestId,
        actionType: action.type,
        source: action.source,
        reason: action.mode,
        timestamp: nowIso
      });
    }

    if (action.type === 'comment.add') {
      const comment: ReviewCommentRecord = {
        commentId: `${requestId}_${session.lastAckVersion + 1}`,
        target: action.target,
        classification: action.classification,
        text: action.text.trim().slice(0, 400),
        createdAt: nowIso
      };

      if (action.target === 'scenario' && action.scenarioId) {
        const current = session.reviewRecordsByScenarioId[action.scenarioId] ?? {
          scenarioId: action.scenarioId,
          primaryRequirementId: 'UNMAPPED',
          acceptanceCriteriaIds: [],
          approvalState: 'pending',
          revisionReason: [],
          comments: [],
          updatedAt: nowIso,
          updatedBy: 'system'
        };

        const next = cloneScenarioRecord(current);
        next.comments.push(comment);

        if (action.classification === 'bug' || action.classification === 'constraint') {
          next.approvalState = 'needs_revision';
          if (!next.revisionReason.includes(action.text.trim())) {
            next.revisionReason.push(action.text.trim());
          }
        }

        next.updatedAt = nowIso;
        next.updatedBy = action.source;
        session.reviewRecordsByScenarioId[action.scenarioId] = next;
      } else {
        session.globalComments.push(comment);
      }

      session.revisionHistory.push({
        requestId,
        actionType: action.type,
        scenarioId: action.scenarioId,
        source: action.source,
        reason: action.classification,
        timestamp: nowIso
      });
    }

    session.lastAckVersion += 1;
    session.updatedAt = nowIso;

    const snapshot = this.buildReviewSnapshot(session);

    this.emit(requestId, 'ui', 'review_action_applied', session.state, {
      actionType: action.type,
      optimisticVersion: action.optimisticVersion,
      ackVersion: session.lastAckVersion,
      approvedCount: snapshot.approvedCount,
      excludedCount: snapshot.excludedCount
    }, session.confidenceProfileId, session.decisionGate);

    return {
      ok: true,
      requestId,
      from: session.state,
      to: session.state,
      ackVersion: session.lastAckVersion,
      reviewSnapshot: snapshot
    };
  }

  private buildReviewSnapshot(session: PipelineSession): ReviewSnapshot {
    const records = Object.values(session.reviewRecordsByScenarioId);
    const scope = computeApprovedScope(records.map(toScopeRecord));

    const commentInputs: RevisionCommentInput[] = [
      ...session.globalComments.map((comment) => toRevisionComment(comment)),
      ...records.flatMap((record) => record.comments.map((comment) => toRevisionComment(comment, record.scenarioId)))
    ];

    const regeneration = computeRegenerationTargets(records.map(toScopeRecord), commentInputs);

    return {
      requestId: session.requestId,
      ackVersion: session.lastAckVersion,
      approvedScenarioIds: scope.approvedScenarioIds,
      excludedScenarioIds: scope.excludedScenarioIds,
      approvedCount: scope.approvedCount,
      excludedCount: scope.excludedCount,
      regenerationScenarioIds: regeneration.regenerationScenarioIds,
      impactedRequirementIds: regeneration.impactedRequirementIds,
      records: Object.fromEntries(records.map((record) => [record.scenarioId, cloneScenarioRecord(record)]))
    };
  }

  private emit(
    requestId: string,
    stage: 'orchestrator' | 'gate' | 'ui',
    action: string,
    state?: PipelineState,
    details?: Record<string, unknown>,
    confidenceProfileId?: string,
    decisionGate?: ConfidenceGate
  ): void {
    const event = createPipelineEvent(
      {
        requestId,
        stage,
        action,
        state,
        confidenceProfileId,
        decisionGate,
        details
      },
      this.now
    );

    this.eventSink.emit(event);
  }
}

export function applyTransitionResult(
  result: TransitionResult,
  requestId: string
): ActionTransitionResult {
  if (!result.ok) {
    return {
      ok: false,
      requestId,
      from: result.from,
      errorCode: result.errorCode
    };
  }

  return {
    ok: true,
    requestId,
    from: result.from,
    to: result.to
  };
}
