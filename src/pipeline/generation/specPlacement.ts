export type SpecPlacementMode = 'patch_existing' | 'create_scoped';

export interface PlacementScenarioInput {
  scenarioId: string;
  functionality: string;
}

export interface SpecPlacementPlan {
  functionality: string;
  specFilePath: string;
  mode: SpecPlacementMode;
  scenarioIds: string[];
}

export interface PlanSpecPlacementsOptions {
  existingSpecPaths?: readonly string[];
}

function normalizeFunctionality(value: string): string {
  const normalized = value.trim();
  return normalized || 'General';
}

function slugifyFunctionality(value: string): string {
  return normalizeFunctionality(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general';
}

function buildExistingPathIndex(existingSpecPaths: readonly string[]): Map<string, string> {
  const byBaseName = new Map<string, string>();

  for (const specPath of existingSpecPaths) {
    const trimmed = specPath.trim();
    if (!trimmed.endsWith('.spec.ts')) {
      continue;
    }
    const baseName = trimmed.split('/').at(-1)?.toLowerCase() ?? '';
    if (!baseName || byBaseName.has(baseName)) {
      continue;
    }
    byBaseName.set(baseName, trimmed);
  }

  return byBaseName;
}

export function planSpecPlacements(
  scenarios: readonly PlacementScenarioInput[],
  options: PlanSpecPlacementsOptions = {}
): SpecPlacementPlan[] {
  const groupedByFunctionality = new Map<string, Set<string>>();

  for (const scenario of scenarios) {
    const functionality = normalizeFunctionality(scenario.functionality);
    const group = groupedByFunctionality.get(functionality) ?? new Set<string>();
    group.add(scenario.scenarioId);
    groupedByFunctionality.set(functionality, group);
  }

  const existingPaths = buildExistingPathIndex(options.existingSpecPaths ?? []);

  return [...groupedByFunctionality.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([functionality, scenarioIds]) => {
      // New files follow <functionality>.spec.ts naming.
      const scopedName = `${slugifyFunctionality(functionality)}.spec.ts`;
      const existingPath = existingPaths.get(scopedName.toLowerCase());

      return {
        functionality,
        specFilePath: existingPath ?? scopedName,
        mode: existingPath ? 'patch_existing' : 'create_scoped',
        scenarioIds: [...scenarioIds].sort((left, right) => left.localeCompare(right))
      };
    });
}
