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
  });
});
