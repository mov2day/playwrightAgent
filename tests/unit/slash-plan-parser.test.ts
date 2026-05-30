import { describe, expect, it } from 'vitest';

import { parseSlashPlanInput } from '../../src/participant/slashPlanParser';

describe('parseSlashPlanInput', () => {
  it('parses strict ticket plus trailing context', () => {
    const result = parseSlashPlanInput('/plan ABC-123 verify login flow');

    expect(result.mode).toBe('ticket');
    if (result.mode === 'ticket') {
      expect(result.ticketId).toBe('ABC-123');
      expect(result.userContext).toBe('verify login flow');
      expect(result.warnings).toEqual([]);
    }
  });

  it('returns no_ticket mode for empty plan command', () => {
    const result = parseSlashPlanInput('/plan');

    expect(result.mode).toBe('no_ticket');
    if (result.mode === 'no_ticket') {
      expect(result.userContext).toBe('');
    }
  });

  it('returns no_ticket mode for free-form context', () => {
    const result = parseSlashPlanInput('/plan validate payment retries');

    expect(result.mode).toBe('no_ticket');
    if (result.mode === 'no_ticket') {
      expect(result.userContext).toBe('validate payment retries');
    }
  });

  it('soft-fails invalid ticket-like first token', () => {
    const result = parseSlashPlanInput('/plan BAD-XYZ cover checkout');

    expect(result.mode).toBe('invalid_ticket_soft_fail');
    if (result.mode === 'invalid_ticket_soft_fail') {
      expect(result.rawToken).toBe('BAD-XYZ');
      expect(result.userContext).toBe('BAD-XYZ cover checkout');
      expect(result.warnings[0]).toContain('strict ticket format');
    }
  });

  it('supports explicit --ticket syntax', () => {
    const result = parseSlashPlanInput('/plan --ticket QA-7 include attachment assertions');

    expect(result.mode).toBe('ticket');
    if (result.mode === 'ticket') {
      expect(result.ticketId).toBe('QA-7');
      expect(result.userContext).toBe('include attachment assertions');
    }
  });

  it('soft-fails invalid explicit --ticket token', () => {
    const result = parseSlashPlanInput('/plan --ticket qa-7 include attachment assertions');

    expect(result.mode).toBe('invalid_ticket_soft_fail');
    if (result.mode === 'invalid_ticket_soft_fail') {
      expect(result.rawToken).toBe('qa-7');
      expect(result.userContext).toBe('include attachment assertions');
      expect(result.warnings[0]).toContain('invalid');
    }
  });
});
