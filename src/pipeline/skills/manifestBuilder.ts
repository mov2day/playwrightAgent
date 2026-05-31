import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SKILL_ROOT = 'skills/playwright-skill';

const ALLOWLISTED_SKILL_PATHS = [
  'skills/playwright-skill/SKILL.md',
  'skills/playwright-skill/PAGE_OBJECT_MODEL_SKILL.md',
  'skills/playwright-skill/SCREENPLAY_PATTERN_SKILL.md',
  'skills/playwright-skill/HELPER_FUNCTIONS_SKILL.md',
  'skills/playwright-skill/API_REFERENCE.md',
  'skills/playwright-skill/lib/helpers.js',
  'skills/playwright-skill/run.js'
] as const;

const DENYLIST_PATTERNS = [
  /^skills\/playwright-skill\/\.git\//,
  /\/\.DS_Store$/,
  /\/\.temp-execution-[^/]+$/
];

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function isDeniedArtifact(relativePath: string): boolean {
  return DENYLIST_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function walkFiles(rootDir: string): string[] {
  const queue = [rootDir];
  const files: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface SkillManifestEntry {
  path: string;
  sha256: string;
  sizeBytes: number;
  content: string;
}

export interface SkillManifest {
  skillRoot: string;
  allowlist: readonly string[];
  entries: SkillManifestEntry[];
  hash: string;
  missingAllowlistEntries: string[];
  deniedArtifacts: string[];
  unreadableAllowlistEntries: string[];
}

export interface BuildSkillManifestInput {
  rootDir?: string;
  skillRoot?: string;
}

export function buildSkillManifest(input: BuildSkillManifestInput = {}): SkillManifest {
  const rootDir = input.rootDir ?? process.cwd();
  const skillRoot = toPosix(input.skillRoot ?? DEFAULT_SKILL_ROOT);
  const allowlist = ALLOWLISTED_SKILL_PATHS
    .map((entry) => entry.replace(DEFAULT_SKILL_ROOT, skillRoot))
    .sort((a, b) => a.localeCompare(b));
  const absoluteSkillRoot = path.join(rootDir, skillRoot);

  const deniedArtifacts: string[] = [];
  const unreadableAllowlistEntries: string[] = [];
  const entries: SkillManifestEntry[] = [];

  const allFiles = walkFiles(absoluteSkillRoot);
  for (const absolutePath of allFiles) {
    const relativePath = toPosix(path.relative(rootDir, absolutePath));
    if (isDeniedArtifact(relativePath)) {
      deniedArtifacts.push(relativePath);
    }
  }

  for (const relativePath of allowlist) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(absolutePath, 'utf8');
      entries.push({
        path: relativePath,
        sha256: hashText(content),
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        content
      });
    } catch {
      unreadableAllowlistEntries.push(relativePath);
    }
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  deniedArtifacts.sort((a, b) => a.localeCompare(b));
  unreadableAllowlistEntries.sort((a, b) => a.localeCompare(b));

  const missingAllowlistEntries = allowlist.filter((relativePath) => !entries.some((entry) => entry.path === relativePath));
  const hashInput = entries
    .map((entry) => `${entry.path}|${entry.sha256}|${entry.sizeBytes}`)
    .join('\n');

  return {
    skillRoot,
    allowlist,
    entries,
    hash: hashText(hashInput),
    missingAllowlistEntries,
    deniedArtifacts,
    unreadableAllowlistEntries
  };
}

