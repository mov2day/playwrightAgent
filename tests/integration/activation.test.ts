import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetParticipantForTests,
  activate,
  PLAYWRIGHT_AGENT_PARTICIPANT_ID,
  type VscodeLikeApi
} from '../../src/extension';

afterEach(() => {
  __resetParticipantForTests();
});

describe('extension activation', () => {
  it('registers PlaywrightAgent participant exactly once', () => {
    const dispose = vi.fn();
    const createChatParticipant = vi.fn(() => ({ dispose }));
    const api: VscodeLikeApi = {
      chat: {
        createChatParticipant
      }
    };

    const subscriptions: Array<{ dispose: () => unknown }> = [];
    const context = {
      subscriptions: {
        push: (value: { dispose: () => unknown }) => {
          subscriptions.push(value);
          return subscriptions.length;
        }
      }
    };

    activate(context as never, api);
    activate(context as never, api);

    expect(createChatParticipant).toHaveBeenCalledTimes(1);
    expect(createChatParticipant).toHaveBeenCalledWith(PLAYWRIGHT_AGENT_PARTICIPANT_ID, expect.any(Function));
    expect(subscriptions).toHaveLength(1);
  });

  it('wires a callable handler through participant registration', async () => {
    const createChatParticipant = vi.fn((_id, handler) => ({
      dispose: vi.fn(),
      handler
    }));

    const api: VscodeLikeApi = {
      chat: {
        createChatParticipant
      }
    };

    const context = {
      subscriptions: {
        push: vi.fn()
      }
    };

    activate(context as never, api);

    const call = createChatParticipant.mock.calls[0];
    const handler = call?.[1] as (...args: unknown[]) => Promise<unknown>;

    expect(typeof handler).toBe('function');

    const response = (await handler('/plan')) as { mode: string; requestId: string };

    expect(response.mode).toBe('no_ticket');
    expect(response.requestId).toMatch(/^req_/);
    expect(['reject', 'approval_required']).toContain(
      (response as { decisionGate?: string }).decisionGate
    );
  });

  it('streams markdown output when invoked with VS Code chat request shape', async () => {
    const createChatParticipant = vi.fn((_id, handler) => ({
      dispose: vi.fn(),
      handler
    }));
    const onDidReceiveMessage = vi.fn();
    const createWebviewPanel = vi.fn(() => ({
      dispose: vi.fn(),
      title: '',
      reveal: vi.fn(),
      webview: {
        html: '',
        options: {},
        onDidReceiveMessage
      },
      onDidDispose: vi.fn()
    }));

    const api: VscodeLikeApi = {
      chat: {
        createChatParticipant
      },
      window: {
        createWebviewPanel
      }
    };

    const context = {
      subscriptions: {
        push: vi.fn()
      }
    };

    activate(context as never, api);

    const call = createChatParticipant.mock.calls[0];
    const handler = call?.[1] as (...args: unknown[]) => Promise<unknown>;
    const stream = {
      markdown: vi.fn()
    };

    await handler(
      { prompt: '/plan verify checkout' },
      {},
      stream,
      {}
    );

    expect(stream.markdown).toHaveBeenCalledTimes(1);
    const streamed = String(stream.markdown.mock.calls[0]?.[0] ?? '');
    expect(streamed).toContain('## PlaywrightAgent');
    expect(streamed).toContain('Request ID:');
    expect(streamed).toContain('Mode: `no_ticket`');
    expect(createWebviewPanel).toHaveBeenCalledTimes(1);
  });

  it('resolves action against last known request when chat history metadata is absent', async () => {
    const createChatParticipant = vi.fn((_id, handler) => ({
      dispose: vi.fn(),
      handler
    }));

    const api: VscodeLikeApi = {
      chat: {
        createChatParticipant
      }
    };

    const context = {
      subscriptions: {
        push: vi.fn()
      }
    };

    activate(context as never, api);

    const call = createChatParticipant.mock.calls[0];
    const handler = call?.[1] as (...args: unknown[]) => Promise<unknown>;
    const stream = {
      markdown: vi.fn()
    };

    await handler(
      { prompt: '/plan WE-987' },
      { history: [] },
      stream,
      {}
    );

    await handler(
      { prompt: 'cancel' },
      { history: [] },
      stream,
      {}
    );

    const outputs = stream.markdown.mock.calls.map((entry) => String(entry[0] ?? '')).join('\n');
    expect(outputs).not.toContain('No active gated request found');
  });

  it('does not penalize no-ticket mode with Jira/Confluence component scores', async () => {
    const createChatParticipant = vi.fn((_id, handler) => ({
      dispose: vi.fn(),
      handler
    }));

    const api: VscodeLikeApi = {
      chat: {
        createChatParticipant
      }
    };

    const context = {
      subscriptions: {
        push: vi.fn()
      }
    };

    activate(context as never, api);

    const call = createChatParticipant.mock.calls[0];
    const handler = call?.[1] as (...args: unknown[]) => Promise<unknown>;
    const response = (await handler('/plan verify checkout and order confirmation journey')) as {
      mode: string;
      confidenceProfileId: string;
      explainability: {
        componentScores: {
          jira: number;
          confluence: number;
        };
      };
    };

    expect(response.mode).toBe('no_ticket');
    expect(response.confidenceProfileId).toBe('v1-no-ticket');
    expect(response.explainability.componentScores.jira).toBe(0);
    expect(response.explainability.componentScores.confluence).toBe(0);
  });

  it('advertises only valid plan approval actions after plan generation', async () => {
    const createChatParticipant = vi.fn((_id, handler) => ({
      dispose: vi.fn(),
      handler
    }));

    const api: VscodeLikeApi = {
      chat: {
        createChatParticipant
      }
    };

    const context = {
      subscriptions: {
        push: vi.fn()
      }
    };

    activate(context as never, api);

    const call = createChatParticipant.mock.calls[0];
    const handler = call?.[1] as (...args: unknown[]) => Promise<unknown>;
    const stream = {
      markdown: vi.fn()
    };

    const result = await handler(
      { prompt: '/plan verify checkout and order confirmation journey' },
      { history: [] },
      stream,
      {}
    ) as {
      metadata: {
        playwrightAgent: {
          availableActions: string[];
          state?: string;
        };
      };
    };

    expect(result.metadata.playwrightAgent.state).toBe('awaiting_plan_approval');
    expect(result.metadata.playwrightAgent.availableActions).toEqual(['approve', 'reject', 'cancel']);
  });

  it('falls back to the real project root when the initial workspace folder is wrong', async () => {
    const createChatParticipant = vi.fn((_id, handler) => ({
      dispose: vi.fn(),
      handler
    }));
    const bogusRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pwagent-bogus-workspace-'));

    const api: VscodeLikeApi = {
      chat: {
        createChatParticipant
      },
      workspace: {
        workspaceFolders: [
          {
            uri: {
              fsPath: bogusRoot
            }
          }
        ]
      }
    };

    const context = {
      subscriptions: {
        push: vi.fn()
      }
    };

    activate(context as never, api);

    const call = createChatParticipant.mock.calls[0];
    const handler = call?.[1] as (...args: unknown[]) => Promise<unknown>;
    const response = await handler('/plan verify checkout and order confirmation journey') as {
      warnings: string[];
      availableActions: string[];
      state?: string;
    };

    expect(response.warnings.some((warning) => warning.includes('manifest_invalid'))).toBe(false);
    expect(response.state).toBe('awaiting_plan_approval');
    expect(response.availableActions).toEqual(['approve', 'reject', 'cancel']);
  });

  it('refreshes the existing review panel when chat quick actions advance the state', async () => {
    const createChatParticipant = vi.fn((_id, handler) => ({
      dispose: vi.fn(),
      handler
    }));
    const panel = {
      dispose: vi.fn(),
      title: '',
      reveal: vi.fn(),
      webview: {
        html: '',
        options: {},
        onDidReceiveMessage: vi.fn()
      },
      onDidDispose: vi.fn()
    };
    const createWebviewPanel = vi.fn(() => panel);

    const api: VscodeLikeApi = {
      chat: {
        createChatParticipant
      },
      window: {
        createWebviewPanel
      }
    };

    const context = {
      subscriptions: {
        push: vi.fn()
      }
    };

    activate(context as never, api);

    const call = createChatParticipant.mock.calls[0];
    const handler = call?.[1] as (...args: unknown[]) => Promise<unknown>;
    const stream = {
      markdown: vi.fn()
    };

    await handler(
      { prompt: '/plan verify checkout and order confirmation journey' },
      { history: [] },
      stream,
      {}
    );

    expect(panel.webview.html).toContain('data-state="awaiting_plan_approval"');

    await handler(
      { prompt: 'approve' },
      { history: [] },
      stream,
      {}
    );

    expect(panel.webview.html).toContain('data-state="plan_approved"');
    expect(createWebviewPanel).toHaveBeenCalledTimes(1);
  });
});
