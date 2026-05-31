import type { AnchorUnsafeReason, WriterMode } from './writeContracts';

const DEFAULT_SAFE_CONFIDENCE = 0.25;

export interface AnchorSafetyInput {
  mode: WriterMode;
  targetPath: string;
  existingContent?: string;
  describeName?: string;
  markerBegin?: string;
  markerEnd?: string;
  confidence?: number;
}

export interface AnchorSafetyResult {
  safe: boolean;
  mode: WriterMode;
  targetPath: string;
  reason?: AnchorUnsafeReason;
  fallbackMode: WriterMode;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasDescribeAnchor(content: string, describeName: string): boolean {
  const escaped = escapeRegExp(describeName.trim());
  const pattern = new RegExp(`describe\\s*\\(\\s*['"\`]${escaped}['"\`]`);
  return pattern.test(content);
}

function unsafe(
  input: AnchorSafetyInput,
  reason: AnchorUnsafeReason,
  fallbackMode: WriterMode
): AnchorSafetyResult {
  return {
    safe: false,
    mode: input.mode,
    targetPath: input.targetPath,
    reason,
    fallbackMode
  };
}

export function evaluateAnchorSafety(input: AnchorSafetyInput): AnchorSafetyResult {
  if (input.mode !== 'patch_existing') {
    return {
      safe: true,
      mode: input.mode,
      targetPath: input.targetPath,
      fallbackMode: input.mode
    };
  }

  if ((input.confidence ?? 1) < DEFAULT_SAFE_CONFIDENCE) {
    return unsafe(input, 'unsafe', 'create_scoped');
  }

  const content = input.existingContent ?? '';
  if (!content.trim()) {
    return unsafe(input, 'missing_anchor', 'create_scoped');
  }

  const describeName = input.describeName?.trim();
  if (!describeName || !hasDescribeAnchor(content, describeName)) {
    return unsafe(input, 'describe_not_found', 'create_scoped');
  }

  const markerBegin = input.markerBegin?.trim();
  const markerEnd = input.markerEnd?.trim();
  const hasMarkerBegin = Boolean(markerBegin);
  const hasMarkerEnd = Boolean(markerEnd);

  if (hasMarkerBegin !== hasMarkerEnd) {
    return unsafe(input, 'marker_mismatch', 'skip');
  }

  if (hasMarkerBegin && hasMarkerEnd) {
    const beginIndex = content.indexOf(markerBegin as string);
    const endIndex = content.indexOf(markerEnd as string);

    if (beginIndex < 0 || endIndex < 0 || endIndex <= beginIndex) {
      return unsafe(input, 'marker_mismatch', 'skip');
    }
  }

  return {
    safe: true,
    mode: input.mode,
    targetPath: input.targetPath,
    fallbackMode: input.mode
  };
}
