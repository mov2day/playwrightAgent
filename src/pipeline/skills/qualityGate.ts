import type { SkillManifest } from './manifestBuilder';

const REQUIRED_LINKED_FILES = [
  'PAGE_OBJECT_MODEL_SKILL.md',
  'SCREENPLAY_PATTERN_SKILL.md',
  'HELPER_FUNCTIONS_SKILL.md'
] as const;

export type SkillGateStage = 'planning' | 'generation' | 'preview' | 'write';

export interface SkillQualityGateReason {
  code:
    | 'manifest_unavailable'
    | 'manifest_invalid'
    | 'frontmatter_schema_invalid'
    | 'linked-file-integrity_failed'
    | 'artifact_hygiene_failed';
  check: 'manifest' | 'frontmatter_schema' | 'linked-file_integrity' | 'artifact_hygiene';
  message: string;
}

export interface SkillQualityGateResult {
  stage: SkillGateStage;
  blocked: boolean;
  fail_closed: boolean;
  requires_user_decision: boolean;
  reasons: SkillQualityGateReason[];
  manifest_hash?: string;
}

function hasRequiredFrontmatter(content: string): boolean {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return false;
  }

  const closingIndex = trimmed.indexOf('\n---', 3);
  if (closingIndex < 0) {
    return false;
  }

  const frontmatterBlock = trimmed.slice(3, closingIndex);
  const lines = frontmatterBlock
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const values = new Map<string, string>();

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values.set(key, value);
  }

  return Boolean(values.get('name')) && Boolean(values.get('description'));
}

function extractMarkdownLinks(content: string): string[] {
  const links: string[] = [];
  const pattern = /\[[^\]]+]\((\.\/[^)]+)\)/g;
  let match = pattern.exec(content);

  while (match) {
    const rawTarget = match[1]?.trim();
    if (rawTarget) {
      links.push(rawTarget.replace(/^\.\//, ''));
    }
    match = pattern.exec(content);
  }

  return links;
}

function findEntry(manifest: SkillManifest, pathSuffix: string): SkillManifest['entries'][number] | undefined {
  return manifest.entries.find((entry) => entry.path.endsWith(pathSuffix));
}

function evaluateFrontmatterSchema(manifest: SkillManifest): SkillQualityGateReason[] {
  const skillEntry = findEntry(manifest, '/SKILL.md');
  if (!skillEntry || !hasRequiredFrontmatter(skillEntry.content)) {
    return [{
      code: 'frontmatter_schema_invalid',
      check: 'frontmatter_schema',
      message: 'SKILL.md frontmatter schema is missing required name/description metadata.'
    }];
  }

  return [];
}

function evaluateLinkedFileIntegrity(manifest: SkillManifest): SkillQualityGateReason[] {
  const skillEntry = findEntry(manifest, '/SKILL.md');
  if (!skillEntry) {
    return [{
      code: 'linked-file-integrity_failed',
      check: 'linked-file_integrity',
      message: 'SKILL.md is missing; linked-file integrity cannot be verified.'
    }];
  }

  const links = extractMarkdownLinks(skillEntry.content);
  const missingTargets = REQUIRED_LINKED_FILES.filter((relativeName) => {
    const linkIsPresent = links.some((target) => target.endsWith(relativeName));
    const fileIsPresent = manifest.entries.some((entry) => entry.path.endsWith(`/${relativeName}`));
    return !linkIsPresent || !fileIsPresent;
  });

  if (missingTargets.length > 0) {
    return [{
      code: 'linked-file-integrity_failed',
      check: 'linked-file_integrity',
      message: `Linked-file integrity failed for: ${missingTargets.join(', ')}.`
    }];
  }

  return [];
}

function evaluateArtifactHygiene(manifest: SkillManifest): SkillQualityGateReason[] {
  if (
    manifest.deniedArtifacts.length === 0
    && manifest.unreadableAllowlistEntries.length === 0
    && manifest.missingAllowlistEntries.length === 0
  ) {
    return [];
  }

  return [{
    code: 'artifact_hygiene_failed',
    check: 'artifact_hygiene',
    message: [
      manifest.deniedArtifacts.length > 0
        ? `denied artifacts=${manifest.deniedArtifacts.length}`
        : '',
      manifest.unreadableAllowlistEntries.length > 0
        ? `unreadable entries=${manifest.unreadableAllowlistEntries.length}`
        : '',
      manifest.missingAllowlistEntries.length > 0
        ? `missing allowlist entries=${manifest.missingAllowlistEntries.length}`
        : ''
    ].filter(Boolean).join('; ')
  }];
}

export function evaluateSkillQualityGate(
  manifest: SkillManifest | undefined,
  stage: SkillGateStage
): SkillQualityGateResult {
  if (!manifest) {
    return {
      stage,
      blocked: true,
      fail_closed: true,
      requires_user_decision: true,
      reasons: [{
        code: 'manifest_unavailable',
        check: 'manifest',
        message: 'Skill manifest is unavailable; fail-closed stage-entry guard applied.'
      }]
    };
  }

  if (!manifest.hash.trim() || manifest.entries.length === 0) {
    return {
      stage,
      blocked: true,
      fail_closed: true,
      requires_user_decision: true,
      manifest_hash: manifest.hash,
      reasons: [{
        code: 'manifest_invalid',
        check: 'manifest',
        message: 'Skill manifest is invalid or empty; fail-closed gate outcome returned.'
      }]
    };
  }

  const reasons = [
    ...evaluateFrontmatterSchema(manifest),
    ...evaluateLinkedFileIntegrity(manifest),
    ...evaluateArtifactHygiene(manifest)
  ];

  return {
    stage,
    blocked: reasons.length > 0,
    fail_closed: reasons.length > 0,
    requires_user_decision: reasons.length > 0,
    manifest_hash: manifest.hash,
    reasons
  };
}

