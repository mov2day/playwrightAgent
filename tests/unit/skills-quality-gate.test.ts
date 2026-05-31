import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildSkillManifest } from '../../src/pipeline/skills/manifestBuilder';
import { evaluateSkillQualityGate } from '../../src/pipeline/skills/qualityGate';

const TEMP_DIRS: string[] = [];

function makeTempRepo(files: Record<string, string>): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwagent-skill-gate-'));
  TEMP_DIRS.push(rootDir);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents, 'utf8');
  }

  return rootDir;
}

function buildSkillFixture(): Record<string, string> {
  return {
    'skills/playwright-skill/SKILL.md': `---
name: playwright-skill
description: test fixture
---

- Design Pattern Skill (POM): [PAGE_OBJECT_MODEL_SKILL.md](./PAGE_OBJECT_MODEL_SKILL.md)
- Design Pattern Skill (Screenplay): [SCREENPLAY_PATTERN_SKILL.md](./SCREENPLAY_PATTERN_SKILL.md)
- Helper Function Skill: [HELPER_FUNCTIONS_SKILL.md](./HELPER_FUNCTIONS_SKILL.md)
- API references: [API_REFERENCE.md](./API_REFERENCE.md)
`,
    'skills/playwright-skill/PAGE_OBJECT_MODEL_SKILL.md': '# pom',
    'skills/playwright-skill/SCREENPLAY_PATTERN_SKILL.md': '# screenplay',
    'skills/playwright-skill/HELPER_FUNCTIONS_SKILL.md': '# helpers',
    'skills/playwright-skill/API_REFERENCE.md': '# api refs',
    'skills/playwright-skill/lib/helpers.js': 'module.exports = { helper: true };',
    'skills/playwright-skill/run.js': 'console.log("run");',
    'skills/playwright-skill/.DS_Store': 'forbidden',
    'skills/playwright-skill/.temp-execution-100.js': 'forbidden-temp',
    'skills/playwright-skill/.git/config': '[core]',
    'skills/playwright-skill/UNLISTED.md': '# should be ignored'
  };
}

afterEach(() => {
  for (const tempDir of TEMP_DIRS) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  TEMP_DIRS.length = 0;
});

describe('skills manifest builder', () => {
  it('includes allowlisted assets only and reports denied artifacts', () => {
    const rootDir = makeTempRepo(buildSkillFixture());

    const manifest = buildSkillManifest({ rootDir });
    const paths = manifest.entries.map((entry) => entry.path);
    const sortedPaths = [...paths].sort((a, b) => a.localeCompare(b));
    const expectedPaths = [
      'skills/playwright-skill/API_REFERENCE.md',
      'skills/playwright-skill/HELPER_FUNCTIONS_SKILL.md',
      'skills/playwright-skill/PAGE_OBJECT_MODEL_SKILL.md',
      'skills/playwright-skill/SCREENPLAY_PATTERN_SKILL.md',
      'skills/playwright-skill/SKILL.md',
      'skills/playwright-skill/lib/helpers.js',
      'skills/playwright-skill/run.js'
    ].sort((a, b) => a.localeCompare(b));

    expect(paths).toEqual(sortedPaths);
    expect(paths).toEqual(expectedPaths);
    expect(manifest.deniedArtifacts).toEqual(
      expect.arrayContaining([
        'skills/playwright-skill/.DS_Store',
        'skills/playwright-skill/.git/config',
        'skills/playwright-skill/.temp-execution-100.js'
      ])
    );
  });

  it('is deterministic for unchanged content', () => {
    const rootDir = makeTempRepo(buildSkillFixture());

    const first = buildSkillManifest({ rootDir });
    const second = buildSkillManifest({ rootDir });

    expect(second).toEqual(first);
  });

  it('changes hash only when allowlisted files change', () => {
    const rootDir = makeTempRepo(buildSkillFixture());
    const unlistedPath = path.join(rootDir, 'skills/playwright-skill/UNLISTED.md');
    const skillPath = path.join(rootDir, 'skills/playwright-skill/SKILL.md');

    const baseline = buildSkillManifest({ rootDir });
    fs.writeFileSync(unlistedPath, '# changed ignored file', 'utf8');
    const afterUnlistedChange = buildSkillManifest({ rootDir });

    expect(afterUnlistedChange.hash).toBe(baseline.hash);

    fs.writeFileSync(skillPath, '# changed allowlisted file', 'utf8');
    const afterAllowlistedChange = buildSkillManifest({ rootDir });

    expect(afterAllowlistedChange.hash).not.toBe(afterUnlistedChange.hash);
  });
});

describe('skills quality gate', () => {
  it('passes when schema, linked-file integrity, and hygiene checks succeed', () => {
    const rootDir = makeTempRepo({
      ...buildSkillFixture(),
      'skills/playwright-skill/.DS_Store': '',
      'skills/playwright-skill/.temp-execution-100.js': '',
      'skills/playwright-skill/.git/config': ''
    });

    fs.rmSync(path.join(rootDir, 'skills/playwright-skill/.DS_Store'), { force: true });
    fs.rmSync(path.join(rootDir, 'skills/playwright-skill/.temp-execution-100.js'), { force: true });
    fs.rmSync(path.join(rootDir, 'skills/playwright-skill/.git/config'), { force: true });

    const manifest = buildSkillManifest({ rootDir });
    const result = evaluateSkillQualityGate(manifest, 'generation');

    expect(result.blocked).toBe(false);
    expect(result.requires_user_decision).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('fails closed when manifest evidence is unavailable', () => {
    const result = evaluateSkillQualityGate(undefined, 'planning');

    expect(result.blocked).toBe(true);
    expect(result.fail_closed).toBe(true);
    expect(result.requires_user_decision).toBe(true);
    expect(result.reasons.some((reason) => reason.code === 'manifest_unavailable')).toBe(true);
  });

  it('fails closed with structured reasons when frontmatter, linked files, or hygiene fail', () => {
    const rootDir = makeTempRepo({
      ...buildSkillFixture(),
      'skills/playwright-skill/SKILL.md': '# no frontmatter and broken links',
      'skills/playwright-skill/SCREENPLAY_PATTERN_SKILL.md': '# removed from integrity set'
    });
    fs.rmSync(path.join(rootDir, 'skills/playwright-skill/SCREENPLAY_PATTERN_SKILL.md'), { force: true });

    const manifest = buildSkillManifest({ rootDir });
    const result = evaluateSkillQualityGate(manifest, 'preview');

    expect(result.blocked).toBe(true);
    expect(result.fail_closed).toBe(true);
    expect(result.requires_user_decision).toBe(true);
    expect(result.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        'frontmatter_schema_invalid',
        'linked-file-integrity_failed',
        'artifact_hygiene_failed'
      ])
    );
  });
});
