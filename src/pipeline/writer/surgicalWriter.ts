import fs from 'node:fs';
import path from 'node:path';

import { evaluateAnchorSafety } from './anchorSafety';
import { createWritePlanEntry, type WriteOutcome, type WritePlanEntryInput } from './writeContracts';

const DEFAULT_FORBID_DELETE = true;
const DEFAULT_PRESERVE_EXISTING = true;

export interface SurgicalWritePlanEntryInput extends WritePlanEntryInput {
  anchorConfidence?: number;
  fallbackTargetPath?: string;
}

export interface SurgicalWriterOptions {
  rootDir?: string;
  forbidDelete?: boolean;
  preserveExisting?: boolean;
}

export interface SurgicalWriteResult {
  outcomes: WriteOutcome[];
}

interface MarkerPair {
  markerBegin?: string;
  markerEnd?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readExistingContent(absolutePath: string): string | undefined {
  if (!fs.existsSync(absolutePath)) {
    return undefined;
  }

  return fs.readFileSync(absolutePath, 'utf8');
}

function ensureParentDirectory(absolutePath: string): void {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
}

function inferMarkerPair(entry: { markerBegin?: string; markerEnd?: string; generatedBlock: string }): MarkerPair {
  const inferredBegin = entry.generatedBlock.match(/\/\/\s*@pwagent:begin:[^\s]+/)?.[0]?.trim();
  const inferredEnd = entry.generatedBlock.match(/\/\/\s*@pwagent:end:[^\s]+/)?.[0]?.trim();

  return {
    markerBegin: entry.markerBegin ?? inferredBegin,
    markerEnd: entry.markerEnd ?? inferredEnd
  };
}

function replaceMarkerBoundedBlock(
  existingContent: string,
  markerBegin: string,
  markerEnd: string,
  generatedBlock: string
): string | undefined {
  const beginIndex = existingContent.indexOf(markerBegin);
  if (beginIndex < 0) {
    return undefined;
  }

  const endIndex = existingContent.indexOf(markerEnd, beginIndex + markerBegin.length);
  if (endIndex < 0 || endIndex <= beginIndex) {
    return undefined;
  }

  const startOfBeginLine = existingContent.lastIndexOf('\n', beginIndex);
  const replaceStart = startOfBeginLine < 0 ? 0 : startOfBeginLine + 1;
  const endLineBreak = existingContent.indexOf('\n', endIndex + markerEnd.length);
  const replaceEnd = endLineBreak < 0 ? existingContent.length : endLineBreak + 1;

  const before = existingContent.slice(0, replaceStart);
  const after = existingContent.slice(replaceEnd);
  const normalizedBlock = generatedBlock.trimEnd();

  return `${before}${normalizedBlock}\n${after}`;
}

function findMatchingBrace(content: string, openBraceIndex: number): number | undefined {
  let depth = 0;

  for (let index = openBraceIndex; index < content.length; index += 1) {
    const char = content[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return undefined;
}

function appendInsideDescribe(
  existingContent: string,
  describeName: string | undefined,
  generatedBlock: string
): string | undefined {
  const describeLabel = describeName?.trim();
  if (!describeLabel) {
    return undefined;
  }

  const describeMatcher = new RegExp(`describe\\s*\\(\\s*['"\`]${escapeRegExp(describeLabel)}['"\`]\\s*,`);
  const describeMatch = describeMatcher.exec(existingContent);
  if (!describeMatch) {
    return undefined;
  }

  const openBraceIndex = existingContent.indexOf('{', describeMatch.index + describeMatch[0].length);
  if (openBraceIndex < 0) {
    return undefined;
  }

  const closeBraceIndex = findMatchingBrace(existingContent, openBraceIndex);
  if (closeBraceIndex === undefined) {
    return undefined;
  }

  const lineStart = existingContent.lastIndexOf('\n', describeMatch.index);
  const linePrefix = lineStart < 0 ? '' : existingContent.slice(lineStart + 1, describeMatch.index);
  const describeIndent = linePrefix.match(/^\s*/)?.[0] ?? '';
  const blockIndent = `${describeIndent}  `;
  const indentedBlock = generatedBlock
    .trim()
    .split('\n')
    .map((line) => `${blockIndent}${line}`)
    .join('\n');
  const insertion = `\n${indentedBlock}\n${describeIndent}`;

  return `${existingContent.slice(0, closeBraceIndex)}${insertion}${existingContent.slice(closeBraceIndex)}`;
}

function resolveScopedTargetPath(targetPath: string, fallbackTargetPath?: string): string {
  const normalizedFallback = fallbackTargetPath?.trim();
  if (normalizedFallback) {
    return normalizedFallback;
  }

  if (targetPath.endsWith('.spec.ts')) {
    return targetPath.replace(/\.spec\.ts$/, '.pwagent.generated.spec.ts');
  }

  return `${targetPath}.pwagent.generated`;
}

function appendGeneratedBlock(existingContent: string | undefined, generatedBlock: string): string {
  const normalized = generatedBlock.trimEnd();
  if (!existingContent || !existingContent.trim()) {
    return `${normalized}\n`;
  }

  if (existingContent.endsWith('\n\n')) {
    return `${existingContent}${normalized}\n`;
  }

  if (existingContent.endsWith('\n')) {
    return `${existingContent}\n${normalized}\n`;
  }

  return `${existingContent}\n\n${normalized}\n`;
}

function writeCreateScopedFile(
  absolutePath: string,
  generatedBlock: string,
  markerPair: MarkerPair
): void {
  ensureParentDirectory(absolutePath);
  const existing = readExistingContent(absolutePath);

  if (existing && markerPair.markerBegin && markerPair.markerEnd) {
    const replaced = replaceMarkerBoundedBlock(existing, markerPair.markerBegin, markerPair.markerEnd, generatedBlock);
    if (replaced !== undefined) {
      fs.writeFileSync(absolutePath, replaced, 'utf8');
      return;
    }
  }

  const next = appendGeneratedBlock(existing, generatedBlock);
  fs.writeFileSync(absolutePath, next, 'utf8');
}

export function executeSurgicalWritePlan(
  entries: readonly SurgicalWritePlanEntryInput[],
  options: SurgicalWriterOptions = {}
): SurgicalWriteResult {
  const rootDir = options.rootDir ?? process.cwd();
  const forbidDelete = options.forbidDelete ?? DEFAULT_FORBID_DELETE;
  const preserveExisting = options.preserveExisting ?? DEFAULT_PRESERVE_EXISTING;
  const outcomes: WriteOutcome[] = [];

  for (const rawEntry of entries) {
    const entry = createWritePlanEntry(rawEntry);
    const markerPair = inferMarkerPair(entry);
    const absoluteTargetPath = path.resolve(rootDir, entry.targetPath);

    if (entry.mode === 'skip') {
      outcomes.push({
        targetPath: entry.targetPath,
        mode: 'skip',
        status: 'skipped',
        reason: 'unsafe',
        noDelete: forbidDelete,
        preserveExisting
      });
      continue;
    }

    if (entry.mode === 'create_scoped') {
      writeCreateScopedFile(absoluteTargetPath, entry.generatedBlock, markerPair);
      outcomes.push({
        targetPath: entry.targetPath,
        mode: 'create_scoped',
        status: 'created',
        noDelete: forbidDelete,
        preserveExisting
      });
      continue;
    }

    const existingContent = readExistingContent(absoluteTargetPath);
    const safety = evaluateAnchorSafety({
      mode: entry.mode,
      targetPath: entry.targetPath,
      existingContent,
      describeName: entry.describeName,
      markerBegin: markerPair.markerBegin,
      markerEnd: markerPair.markerEnd,
      confidence: rawEntry.anchorConfidence
    });

    if (!safety.safe) {
      if (safety.fallbackMode === 'create_scoped') {
        const scopedTargetPath = resolveScopedTargetPath(entry.targetPath, rawEntry.fallbackTargetPath);
        writeCreateScopedFile(path.resolve(rootDir, scopedTargetPath), entry.generatedBlock, markerPair);
        outcomes.push({
          targetPath: scopedTargetPath,
          mode: 'create_scoped',
          status: 'created',
          noDelete: forbidDelete,
          preserveExisting
        });
      } else {
        outcomes.push({
          targetPath: entry.targetPath,
          mode: 'skip',
          status: 'skipped',
          reason: safety.reason,
          noDelete: forbidDelete,
          preserveExisting
        });
      }
      continue;
    }

    let nextContent: string | undefined;
    if (markerPair.markerBegin && markerPair.markerEnd && existingContent) {
      nextContent = replaceMarkerBoundedBlock(
        existingContent,
        markerPair.markerBegin,
        markerPair.markerEnd,
        entry.generatedBlock
      );
    }

    if (nextContent === undefined) {
      nextContent = appendInsideDescribe(existingContent ?? '', entry.describeName, entry.generatedBlock);
    }

    if (nextContent === undefined) {
      const scopedTargetPath = resolveScopedTargetPath(entry.targetPath, rawEntry.fallbackTargetPath);
      writeCreateScopedFile(path.resolve(rootDir, scopedTargetPath), entry.generatedBlock, markerPair);
      outcomes.push({
        targetPath: scopedTargetPath,
        mode: 'create_scoped',
        status: 'created',
        noDelete: forbidDelete,
        preserveExisting
      });
      continue;
    }

    ensureParentDirectory(absoluteTargetPath);
    fs.writeFileSync(absoluteTargetPath, nextContent, 'utf8');
    outcomes.push({
      targetPath: entry.targetPath,
      mode: 'patch_existing',
      status: 'patched',
      noDelete: forbidDelete,
      preserveExisting
    });
  }

  return {
    outcomes
  };
}
