import { buildScenarioMarkerId } from './markerIds';

export interface ScriptScenarioInput {
  scenarioId: string;
  scenarioName: string;
  primaryRequirementId: string;
  functionality: string;
  testBody: string;
}

export interface ComposeScriptOptions {
  fixtureImportPath?: string;
  fixtureName?: string;
}

function indentBody(code: string): string {
  return code
    .trim()
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

export function composeScenarioBlock(scenario: ScriptScenarioInput): string {
  const markerId = buildScenarioMarkerId({
    scenarioId: scenario.scenarioId,
    primaryRequirementId: scenario.primaryRequirementId,
    functionality: scenario.functionality
  });

  return [
    `// @pwagent:begin:${markerId}`,
    `test('${scenario.scenarioName}', async ({ page }) => {`,
    indentBody(scenario.testBody),
    '});',
    `// @pwagent:end:${markerId}`
  ].join('\n');
}

export function composeSpecScript(
  scenarios: readonly ScriptScenarioInput[],
  options: ComposeScriptOptions = {}
): string {
  const fixtureImportPath = options.fixtureImportPath ?? '@playwright/test';
  const fixtureName = options.fixtureName ?? 'test';
  const ordered = [...scenarios].sort((left, right) => left.scenarioId.localeCompare(right.scenarioId));

  const blocks = ordered.map((scenario) => composeScenarioBlock(scenario));

  return [
    `import { test } from '${fixtureImportPath}';`,
    '',
    `// fixture: ${fixtureName}`,
    ...blocks.flatMap((block) => ['', block])
  ].join('\n');
}
