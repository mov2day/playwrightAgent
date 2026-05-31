import { describe, expect, it } from 'vitest';

import { buildScenarioMarkerId } from '../../src/pipeline/generation/markerIds';

describe('buildScenarioMarkerId', () => {
  it('is deterministic for same scenario and requirement inputs', () => {
    const left = buildScenarioMarkerId({
      scenarioId: 'scn_auth_1',
      primaryRequirementId: 'REQ-1',
      functionality: 'Auth'
    });

    const right = buildScenarioMarkerId({
      scenarioId: 'scn_auth_1',
      primaryRequirementId: 'REQ-1',
      functionality: 'Auth'
    });

    expect(left).toBe(right);
    expect(left).toMatch(/^pwagent_[a-z0-9_]+_[a-f0-9]{12}$/);
  });

  it('changes when scenario identity changes', () => {
    const base = buildScenarioMarkerId({
      scenarioId: 'scn_auth_1',
      primaryRequirementId: 'REQ-1',
      functionality: 'Auth'
    });

    const changedScenario = buildScenarioMarkerId({
      scenarioId: 'scn_auth_2',
      primaryRequirementId: 'REQ-1',
      functionality: 'Auth'
    });

    const changedRequirement = buildScenarioMarkerId({
      scenarioId: 'scn_auth_1',
      primaryRequirementId: 'REQ-2',
      functionality: 'Auth'
    });

    expect(changedScenario).not.toBe(base);
    expect(changedRequirement).not.toBe(base);
  });
});
