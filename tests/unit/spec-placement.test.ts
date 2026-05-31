import { describe, expect, it } from 'vitest';

import { planSpecPlacements } from '../../src/pipeline/generation/specPlacement';

describe('planSpecPlacements', () => {
  it('groups scenarios by functionality into one deterministic spec target', () => {
    const placements = planSpecPlacements(
      [
        { scenarioId: 'scn_checkout_2', functionality: 'Checkout' },
        { scenarioId: 'scn_auth_1', functionality: 'Auth' },
        { scenarioId: 'scn_checkout_1', functionality: 'Checkout' }
      ],
      {
        existingSpecPaths: []
      }
    );

    expect(placements).toEqual([
      {
        functionality: 'Auth',
        specFilePath: 'auth.spec.ts',
        mode: 'create_scoped',
        scenarioIds: ['scn_auth_1']
      },
      {
        functionality: 'Checkout',
        specFilePath: 'checkout.spec.ts',
        mode: 'create_scoped',
        scenarioIds: ['scn_checkout_1', 'scn_checkout_2']
      }
    ]);
  });

  it('emits canonical modes for existing and new scoped specs', () => {
    const placements = planSpecPlacements(
      [
        { scenarioId: 'scn_auth_1', functionality: 'Auth' },
        { scenarioId: 'scn_profile_1', functionality: 'Profile Settings' }
      ],
      {
        existingSpecPaths: ['tests/e2e/auth.spec.ts']
      }
    );

    expect(placements).toEqual([
      {
        functionality: 'Auth',
        specFilePath: 'tests/e2e/auth.spec.ts',
        mode: 'patch_existing',
        scenarioIds: ['scn_auth_1']
      },
      {
        functionality: 'Profile Settings',
        specFilePath: 'profile-settings.spec.ts',
        mode: 'create_scoped',
        scenarioIds: ['scn_profile_1']
      }
    ]);
  });
});
