import * as vscode from 'vscode';
import { createParticipantRequestHandler } from './participant/handler';

export const PLAYWRIGHT_AGENT_PARTICIPANT_ID = '@PlaywrightAgent';

type DisposableLike = { dispose(): unknown };
type ParticipantFactory = (id: string, handler: (...args: unknown[]) => unknown) => DisposableLike;

export interface VscodeLikeApi {
  chat?: {
    createChatParticipant?: ParticipantFactory;
  };
  window?: {
    showWarningMessage?: (message: string) => unknown;
  };
}

let participantDisposable: DisposableLike | undefined;

function resolveApi(api?: VscodeLikeApi): VscodeLikeApi {
  if (api) {
    return api;
  }
  return vscode as unknown as VscodeLikeApi;
}

export function registerPlaywrightAgentParticipant(
  api: VscodeLikeApi,
  handler = createParticipantRequestHandler()
): DisposableLike | undefined {
  if (participantDisposable) {
    return participantDisposable;
  }

  const factory = api.chat?.createChatParticipant;
  if (typeof factory !== 'function') {
    api.window?.showWarningMessage?.('Chat participant API unavailable. PlaywrightAgent participant not registered.');
    return undefined;
  }

  participantDisposable = factory(PLAYWRIGHT_AGENT_PARTICIPANT_ID, handler);
  return participantDisposable;
}

export function activate(context: vscode.ExtensionContext, api?: VscodeLikeApi): void {
  const resolvedApi = resolveApi(api);
  const disposable = registerPlaywrightAgentParticipant(resolvedApi);

  if (disposable) {
    context.subscriptions.push(disposable as unknown as vscode.Disposable);
  }
}

export function deactivate(): void {
  participantDisposable?.dispose();
  participantDisposable = undefined;
}

export function __resetParticipantForTests(): void {
  participantDisposable = undefined;
}
