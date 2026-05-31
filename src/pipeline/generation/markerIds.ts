import { createHash } from 'node:crypto';

export interface ScenarioMarkerSeed {
  scenarioId: string;
  primaryRequirementId: string;
  functionality: string;
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'general';
}

export function buildScenarioMarkerId(seed: ScenarioMarkerSeed): string {
  const functionalityToken = normalizeToken(seed.functionality);
  const digest = createHash('sha1')
    .update(`${seed.scenarioId.trim()}|${seed.primaryRequirementId.trim()}|${functionalityToken}`)
    .digest('hex')
    .slice(0, 12);

  return `pwagent_${functionalityToken}_${digest}`;
}
