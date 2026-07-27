import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';
import { LocalToolConfluenceClient } from './adapters/confluenceClient';
import { createDefaultEventSink } from './adapters/eventSink';
import { LocalToolJiraClient } from './adapters/jiraClient';
import { runLocalToolCommand, type LocalToolRunner } from './adapters/localToolRunner';
import type { QuickAction } from './participant/actions';
import type { ConfidenceGate, } from './pipeline/confidence/confidenceContracts';
import type { ScenarioPlanRecord } from './pipeline/planning/planContracts';
import { buildPlanReviewBundle } from './pipeline/planning/scenarioGrouping';
import { createParticipantRequestHandler } from './participant/handler';
import { PipelineOrchestrator } from './pipeline/orchestrator';
import type { PipelineState } from './pipeline/stateMachine';
import { buildReviewViewModel, type ReviewCommentEntry } from './ui/reviewModel';
import { isReviewActionEnvelope } from './ui/reviewActions';
import { renderPlanReviewShell } from './ui/planReviewShell';

export const PLAYWRIGHT_AGENT_PARTICIPANT_ID = 'playwrightagent-extension-foundation.playwrightagent';
const PLAN_REVIEW_PANEL_TYPE = 'playwrightagent.planReview';
const REVIEW_PANEL_VIEW_COLUMN = (vscode as unknown as { ViewColumn?: { Beside?: unknown } }).ViewColumn?.Beside ?? 2;

type DisposableLike = { dispose(): unknown };
type WebviewLike = {
  html: string;
  options?: {
    enableScripts?: boolean;
  };
  onDidReceiveMessage?: (listener: (message: unknown) => void) => DisposableLike;
};
type WebviewPanelLike = DisposableLike & {
  title?: string;
  webview: WebviewLike;
  reveal?: (viewColumn?: unknown) => void;
  onDidDispose?: (listener: () => void) => DisposableLike;
};
type ParticipantLike = DisposableLike & {
  followupProvider?: {
    provideFollowups: (result: { metadata?: { [key: string]: unknown } }) => Array<{
      prompt: string;
      label?: string;
      participant?: string;
      command?: string;
    }>;
  };
};
type ParticipantFactory = (id: string, handler: (...args: unknown[]) => unknown) => ParticipantLike;

export interface VscodeLikeApi {
  chat?: {
    createChatParticipant?: ParticipantFactory;
  };
  workspace?: {
    workspaceFolders?: Array<{
      uri: {
        fsPath: string;
      };
    }>;
  };
  window?: {
    activeTextEditor?: {
      document?: {
        uri?: {
          fsPath: string;
        };
      };
    };
    showWarningMessage?: (message: string) => unknown;
    createWebviewPanel?: (
      viewType: string,
      title: string,
      showOptions: unknown,
      options?: {
        enableScripts?: boolean;
        retainContextWhenHidden?: boolean;
      }
    ) => WebviewPanelLike;
  };
}

let participantDisposable: ParticipantLike | undefined;
let sharedOrchestrator: PipelineOrchestrator | undefined;
let sharedRuntimeRoot: string | undefined;
let sharedSkillBundleRoot: string | undefined;
let reviewPanel: WebviewPanelLike | undefined;
const reviewScenariosByRequest = new Map<string, ScenarioPlanRecord[]>();

function hasSkillBundleAtRoot(candidateRoot: string | undefined): boolean {
  if (!candidateRoot) {
    return false;
  }

  return fs.existsSync(path.join(candidateRoot, 'skills', 'playwright-skill', 'SKILL.md'));
}

function findProjectRoot(candidatePath: string | undefined): string | undefined {
  if (!candidatePath) {
    return undefined;
  }

  let current = candidatePath;
  try {
    const stat = fs.statSync(candidatePath);
    if (!stat.isDirectory()) {
      current = path.dirname(candidatePath);
    }
  } catch {
    current = path.dirname(candidatePath);
  }

  while (true) {
    if (hasSkillBundleAtRoot(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function resolveWorkspaceRoot(api: VscodeLikeApi): string | undefined {
  const candidates = [
    api.workspace?.workspaceFolders?.[0]?.uri.fsPath,
    api.window?.activeTextEditor?.document?.uri?.fsPath,
    process.cwd()
  ];

  for (const candidate of candidates) {
    const resolved = findProjectRoot(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return api.workspace?.workspaceFolders?.[0]?.uri.fsPath;
}

function resolveExtensionSkillBundleRoot(): string | undefined {
  const candidates = [
    sharedSkillBundleRoot,
    path.resolve(__dirname, '..'),
    process.cwd()
  ];

  for (const candidate of candidates) {
    const resolved = findProjectRoot(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return sharedSkillBundleRoot ?? path.resolve(__dirname, '..');
}

function resolveScriptPath(workspaceRoot: string | undefined, relativeScriptPath: string): string | undefined {
  if (!workspaceRoot) {
    return undefined;
  }

  const candidate = path.join(workspaceRoot, relativeScriptPath);
  return fs.existsSync(candidate) ? candidate : undefined;
}

function createWorkspaceCommandRunner(workspaceRoot: string | undefined): LocalToolRunner | undefined {
  if (!workspaceRoot) {
    return undefined;
  }

  return (command, args, options) => runLocalToolCommand(command, args, {
    ...options,
    cwd: options?.cwd ?? workspaceRoot
  });
}

function resolveApi(api?: VscodeLikeApi): VscodeLikeApi {
  if (api) {
    return api;
  }
  return vscode as unknown as VscodeLikeApi;
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

function isReviewableState(state: PipelineState | undefined): state is PipelineState {
  return state === 'awaiting_plan_approval'
    || state === 'plan_approved'
    || state === 'awaiting_script_approval'
    || state === 'script_approved'
    || state === 'ready_to_write'
    || state === 'awaiting_guardrail_decision';
}

function toReviewCommentEntries(snapshot: ReturnType<PipelineOrchestrator['getReviewSnapshot']>): ReviewCommentEntry[] {
  return snapshot?.globalComments.map((comment) => ({
    commentId: comment.commentId,
    target: comment.target,
    classification: comment.classification,
    text: comment.text,
    createdAt: comment.createdAt
  })) ?? [];
}

function mergeScenariosForReview(
  requestId: string,
  orchestrator: PipelineOrchestrator | undefined
): ScenarioPlanRecord[] | undefined {
  const baseScenarios = reviewScenariosByRequest.get(requestId);
  if (!baseScenarios) {
    return undefined;
  }

  const snapshot = orchestrator?.getReviewSnapshot(requestId);
  if (!snapshot) {
    return baseScenarios;
  }

  return baseScenarios.map((scenario) => {
    const record = snapshot.records[scenario.scenarioId];
    if (!record) {
      return scenario;
    }

    return {
      ...scenario,
      approvalState: record.approvalState,
      revisionReason: [...record.revisionReason],
      commentRefs: record.comments.map((comment) => ({
        commentId: comment.commentId,
        target: comment.target,
        classification: comment.classification,
        text: comment.text,
        createdAt: comment.createdAt
      }))
    };
  });
}

function renderReviewPanel(
  api: VscodeLikeApi,
  requestId: string,
  state: PipelineState,
  summary: string,
  actions: readonly QuickAction[],
  scenarios: readonly ScenarioPlanRecord[],
  orchestrator: PipelineOrchestrator | undefined
): void {
  const panelFactory = api.window?.createWebviewPanel;
  if (typeof panelFactory !== 'function') {
    return;
  }

  const mergedScenarios = mergeScenariosForReview(requestId, orchestrator) ?? [...scenarios];
  reviewScenariosByRequest.set(requestId, mergedScenarios);
  const bundle = buildPlanReviewBundle(mergedScenarios);
  const snapshot = orchestrator?.getReviewSnapshot(requestId);
  const reviewModel = buildReviewViewModel({
    requestId,
    state,
    bundle,
    availableActions: actions,
    globalComments: toReviewCommentEntries(snapshot)
  });

  if (!reviewPanel) {
    reviewPanel = panelFactory(
      PLAN_REVIEW_PANEL_TYPE,
      'PlaywrightAgent Plan Review',
      { viewColumn: REVIEW_PANEL_VIEW_COLUMN, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true }
    );
    reviewPanel.onDidDispose?.(() => {
      reviewPanel = undefined;
    });
    reviewPanel.webview.onDidReceiveMessage?.((message) => {
      const request = message as { kind?: string; requestId?: string; action?: QuickAction };
      if (!sharedOrchestrator || typeof request?.requestId !== 'string') {
        return;
      }

      if (request.kind === 'quickAction' && request.action) {
        sharedOrchestrator.handleQuickAction(request.requestId, request.action);
      } else if (isReviewActionEnvelope(message)) {
        sharedOrchestrator.applyScenarioAction(request.requestId, message);
      } else {
        return;
      }

      const session = sharedOrchestrator.getSession(request.requestId);
      const nextScenarios = mergeScenariosForReview(request.requestId, sharedOrchestrator);
      if (!session || !nextScenarios) {
        return;
      }

      renderReviewPanel(
        api,
        request.requestId,
        session.state,
        `Review plan for ${request.requestId}`,
        actionsForState(session.state, session.decisionGate),
        nextScenarios,
        sharedOrchestrator
      );
    });
  }

  reviewPanel.title = `PlaywrightAgent Plan Review · ${requestId}`;
  reviewPanel.webview.options = {
    enableScripts: true
  };
  reviewPanel.webview.html = renderPlanReviewShell({
    requestId,
    state,
    summary,
    actions,
    reviewModel
  });
  reviewPanel.reveal?.(REVIEW_PANEL_VIEW_COLUMN);
}

function maybeOpenPlanReview(
  api: VscodeLikeApi,
  result: unknown,
  orchestrator: PipelineOrchestrator | undefined
): void {
  const payload = typeof result === 'object' && result !== null && 'metadata' in result
    ? (result as {
        metadata?: {
          playwrightAgent?: {
            requestId?: string;
            state?: PipelineState;
            availableActions?: QuickAction[];
            planSummary?: string;
            planScenarios?: ScenarioPlanRecord[];
          };
        };
      }).metadata?.playwrightAgent
    : (result as {
        requestId?: string;
        state?: PipelineState;
        availableActions?: QuickAction[];
        planSummary?: string;
        planScenarios?: ScenarioPlanRecord[];
      } | undefined);

  if (!payload?.requestId || !payload.state || !isReviewableState(payload.state)) {
    return;
  }

  const scenarios = payload.planScenarios && payload.planScenarios.length > 0
    ? payload.planScenarios
    : mergeScenariosForReview(payload.requestId, orchestrator);

  if (!scenarios || scenarios.length === 0) {
    return;
  }

  reviewScenariosByRequest.set(payload.requestId, scenarios);
  renderReviewPanel(
    api,
    payload.requestId,
    payload.state,
    payload.planSummary ?? `Review plan for ${payload.requestId}`,
    payload.availableActions ?? actionsForState(payload.state),
    scenarios,
    orchestrator
  );
}

export function registerPlaywrightAgentParticipant(
  api: VscodeLikeApi,
  handler?: (...args: unknown[]) => Promise<unknown>
): ParticipantLike | undefined {
  if (participantDisposable) {
    return participantDisposable;
  }

  const factory = api.chat?.createChatParticipant;
  if (typeof factory !== 'function') {
    api.window?.showWarningMessage?.('Chat participant API unavailable. PlaywrightAgent participant not registered.');
    return undefined;
  }

  const buildHandlerForCurrentWorkspace = (): ((...args: unknown[]) => Promise<unknown>) => {
    if (handler) {
      return handler;
    }

    const workspaceRoot = resolveWorkspaceRoot(api);
    const jiraScriptPath = resolveScriptPath(workspaceRoot, path.join('scripts', 'jira-fetch.mjs'));
    const confluenceScriptPath = resolveScriptPath(workspaceRoot, path.join('scripts', 'confluence-search.mjs'));
    const workspaceCommandRunner = createWorkspaceCommandRunner(workspaceRoot);
    const sharedEventSink = createDefaultEventSink({
      rootDir: workspaceRoot
    });

    const skillBundleRoot = resolveExtensionSkillBundleRoot();
    if (
      !sharedOrchestrator
      || sharedRuntimeRoot !== workspaceRoot
      || sharedSkillBundleRoot !== skillBundleRoot
    ) {
      sharedOrchestrator = new PipelineOrchestrator({
        eventSink: sharedEventSink,
        rootDir: workspaceRoot,
        skillManifestRootDir: skillBundleRoot
      });
      sharedRuntimeRoot = workspaceRoot;
      sharedSkillBundleRoot = skillBundleRoot;
    }

    return createParticipantRequestHandler({
      repoRootDir: workspaceRoot,
      eventSink: sharedEventSink,
      orchestrator: sharedOrchestrator,
      executionRunOptions: workspaceCommandRunner
        ? {
            commandRunner: workspaceCommandRunner
          }
        : undefined,
      jiraClient: jiraScriptPath
        ? new LocalToolJiraClient({
            baseArgs: [jiraScriptPath],
            cwd: workspaceRoot,
            runner: workspaceCommandRunner
          })
        : undefined,
      confluenceClient: confluenceScriptPath
        ? new LocalToolConfluenceClient({
            baseArgs: [confluenceScriptPath],
            cwd: workspaceRoot,
            runner: workspaceCommandRunner
          })
        : undefined
    });
  };

  const reviewAwareHandler = async (...args: unknown[]) => {
    const resolvedHandler = buildHandlerForCurrentWorkspace();
    const result = await resolvedHandler(...args);
    maybeOpenPlanReview(api, result, sharedOrchestrator);
    return result;
  };

  participantDisposable = factory(PLAYWRIGHT_AGENT_PARTICIPANT_ID, reviewAwareHandler);
  participantDisposable.followupProvider = {
    provideFollowups: (result) => {
      const payload = result.metadata?.playwrightAgent as
        | { availableActions?: unknown }
        | undefined;
      const actions = Array.isArray(payload?.availableActions)
        ? payload.availableActions.filter((value): value is string => typeof value === 'string')
        : [];

      return actions.map((action) => ({
        prompt: action,
        label: action[0]?.toUpperCase() + action.slice(1),
        participant: PLAYWRIGHT_AGENT_PARTICIPANT_ID
      }));
    }
  };

  return participantDisposable;
}

export function activate(context: vscode.ExtensionContext, api?: VscodeLikeApi): void {
  sharedSkillBundleRoot = findProjectRoot(context.extensionPath) ?? context.extensionPath;
  const resolvedApi = resolveApi(api);
  const wasRegistered = Boolean(participantDisposable);
  const disposable = registerPlaywrightAgentParticipant(resolvedApi);

  if (disposable && !wasRegistered) {
    context.subscriptions.push(disposable as unknown as vscode.Disposable);
  }
}

export function deactivate(): void {
  participantDisposable?.dispose();
  participantDisposable = undefined;
  reviewPanel?.dispose();
  reviewPanel = undefined;
}

export function __resetParticipantForTests(): void {
  participantDisposable = undefined;
  sharedOrchestrator = undefined;
  sharedRuntimeRoot = undefined;
  sharedSkillBundleRoot = undefined;
  reviewPanel = undefined;
  reviewScenariosByRequest.clear();
}
