import { describe, expect, it } from 'vitest';

import { redactSensitiveText } from '../../src/adapters/localToolRunner';

describe('redactSensitiveText', () => {
  it('redacts bearer and authorization variants including extended token characters', () => {
    const input = [
      'Authorization: Bearer LEAK_CANARY_BEARER+/=',
      'authorization=Bearer LEAK_CANARY_SECONDARY_123._-',
      'Bearer LEAK_CANARY_STANDALONE+/='
    ].join('\n');

    const redacted = redactSensitiveText(input);

    expect(redacted).toContain('Bearer [REDACTED]');
    expect(redacted).not.toContain('LEAK_CANARY_BEARER+/=');
    expect(redacted).not.toContain('LEAK_CANARY_SECONDARY_123._-');
    expect(redacted).not.toContain('LEAK_CANARY_STANDALONE+/=');
    expect(redactSensitiveText(redacted)).toBe(redacted);
  });

  it('redacts header-style and quoted key/value credential patterns', () => {
    const input = [
      'x-api-key: LEAK_CANARY_HEADER_VALUE',
      '"token":"LEAK_CANARY_QUOTED_TOKEN"',
      "'secret'='LEAK_CANARY_QUOTED_SECRET'"
    ].join('\n');

    const redacted = redactSensitiveText(input);

    expect(redacted).toContain('[REDACTED]');
    expect(redacted).not.toContain('LEAK_CANARY_HEADER_VALUE');
    expect(redacted).not.toContain('LEAK_CANARY_QUOTED_TOKEN');
    expect(redacted).not.toContain('LEAK_CANARY_QUOTED_SECRET');
    expect(redactSensitiveText(redacted)).toBe(redacted);
  });
});
