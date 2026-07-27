import { describe, expect, it } from 'vitest';

import { InMemoryEventSink } from '../../src/adapters/eventSink';
import { handlePlanCommand } from '../../src/participant/handler';

describe('no-ticket and soft-fail plan flow', () => {
  it('starts guided no-ticket flow for /plan with no args', () => {
    const sink = new InMemoryEventSink();
    const response = handlePlanCommand('/plan', {
      eventSink: sink,
      requestIdFactory: () => 'req_fixed_1',
      now: () => new Date('2026-05-30T13:00:00.000Z')
    });

    expect(response.mode).toBe('no_ticket');
    expect(response.requestId).toBe('req_fixed_1');
    expect(response.warnings).toEqual([]);

    const events = sink.getEvents();
    expect(events).toHaveLength(4);
    expect(events.every((event) => event.requestId === 'req_fixed_1')).toBe(true);
    const bootstrapEvent = events.find((event) => event.action === 'context_bootstrapped');
    expect(bootstrapEvent?.details).toMatchObject({ hasUserContext: false });
  });

  it('soft-fails invalid ticket token and preserves user context', () => {
    const sink = new InMemoryEventSink();
    const response = handlePlanCommand('/plan BAD-XYZ include retry scenario', {
      eventSink: sink,
      requestIdFactory: () => 'req_fixed_2',
      now: () => new Date('2026-05-30T13:00:00.000Z')
    });

    expect(response.mode).toBe('invalid_ticket_soft_fail');
    expect(response.userContext).toBe('BAD-XYZ include retry scenario');
    expect(response.warnings[0]).toContain('strict ticket format');

    const events = sink.getEvents();
    expect(events).toHaveLength(4);
    expect(events.every((event) => event.requestId === 'req_fixed_2')).toBe(true);
    const bootstrapEvent = events.find((event) => event.action === 'context_bootstrapped');
    expect(bootstrapEvent?.details).toMatchObject({
      hasUserContext: true,
      source: 'user_input'
    });
  });

  it('ignores standalone gate action tokens as plan context', () => {
    const sink = new InMemoryEventSink();
    const response = handlePlanCommand('cancel', {
      eventSink: sink,
      requestIdFactory: () => 'req_fixed_3',
      now: () => new Date('2026-05-30T13:00:00.000Z')
    });

    expect(response.mode).toBe('no_ticket');
    expect(response.userContext).toBeUndefined();
    expect(response.warnings[0]).toContain('gate action token');
  });
});
