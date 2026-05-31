export const SCOPED_RUN_SCOPE_MODES = ['generated_or_updated', 'full_suite_opt_in'] as const;

export type ScopedRunScopeMode = typeof SCOPED_RUN_SCOPE_MODES[number];

export interface ScopedRunRequestInput {
  requestId: string;
  scopeMode?: ScopedRunScopeMode;
  generatedTargets?: readonly string[];
  updatedTargets?: readonly string[];
  generatedOrUpdatedTargets?: readonly string[];
}

export interface ScopedRunRequest {
  requestId: string;
  scopeMode: ScopedRunScopeMode;
  targetSource: 'generated|updated';
  targets: string[];
}

export interface ScopedRunCommandPreview {
  command: string;
  args: string[];
  display: string;
}

function normalizeTargets(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function createScopedRunRequest(input: ScopedRunRequestInput): ScopedRunRequest {
  const scopeMode: ScopedRunScopeMode = input.scopeMode ?? 'generated_or_updated';
  const targets = normalizeTargets([
    ...(input.generatedOrUpdatedTargets ?? []),
    ...(input.generatedTargets ?? []),
    ...(input.updatedTargets ?? [])
  ]);

  return {
    requestId: input.requestId.trim(),
    scopeMode,
    targetSource: 'generated|updated',
    targets
  };
}
