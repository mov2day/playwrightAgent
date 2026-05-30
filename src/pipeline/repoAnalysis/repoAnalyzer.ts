import fs from 'node:fs';
import path from 'node:path';

import type {
  AnalyzerFinding,
  RepoAnalysisResult,
  RepoPattern,
  RepoScanSnapshot
} from './contracts';
import { detectFrameworkFinding } from './detectors/frameworkDetector';
import { detectPatternClassification } from './detectors/patternDetector';
import { detectReuseCandidates } from './detectors/reuseDetector';
import { buildRepoAnalysisSummary } from './summary';

const DEFAULT_MAX_FILES = 800;
const TEXT_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.cjs',
  '.mjs'
]);
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'coverage', '.planning']);

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function isTextFile(filePath: string): boolean {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walkTextFiles(rootDir: string, maxFiles: number): string[] {
  const queue = [rootDir];
  const files: string[] = [];

  while (queue.length > 0 && files.length < maxFiles) {
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
      if (files.length >= maxFiles) {
        break;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          queue.push(fullPath);
        }
      } else if (entry.isFile() && isTextFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function readFileContents(rootDir: string, files: string[]): Record<string, string> {
  const fileContents: Record<string, string> = {};

  for (const absolutePath of files) {
    const relativePath = toPosix(path.relative(rootDir, absolutePath));
    try {
      fileContents[relativePath] = fs.readFileSync(absolutePath, 'utf8');
    } catch {
      fileContents[relativePath] = '';
    }
  }

  return fileContents;
}

export function buildRepoScanSnapshot(rootDir: string, maxFiles = DEFAULT_MAX_FILES): RepoScanSnapshot {
  const textFiles = walkTextFiles(rootDir, maxFiles);
  const fileContents = readFileContents(rootDir, textFiles);
  const files = textFiles.map((file) => toPosix(path.relative(rootDir, file)));

  let packageJson: RepoScanSnapshot['packageJson'];
  try {
    const packageJsonPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      packageJson = {
        dependencies: parsed.dependencies,
        devDependencies: parsed.devDependencies
      };
    }
  } catch {
    packageJson = undefined;
  }

  return {
    files,
    fileContents,
    packageJson
  };
}

function applyUnknownFallback(
  findings: AnalyzerFinding[],
  threshold: number,
  warningPrefix: string
): { findings: AnalyzerFinding[]; warnings: string[]; confidencePenalty: number } {
  const warnings: string[] = [];
  let confidencePenalty = 0;

  const normalizedFindings = findings.map((finding) => {
    const isCritical = finding.category === 'framework' || finding.category === 'pattern';
    if (!isCritical || finding.confidence >= threshold) {
      return finding;
    }

    confidencePenalty += 0.15;
    const warning = `${warningPrefix} ${finding.category} confidence is below ${threshold}.`;
    warnings.push(warning);

    return {
      ...finding,
      result: 'unknown',
      unknownReason: 'Low detector confidence; conservative fallback applied.',
      notes: `${finding.notes ?? ''} Unknown fallback applied.`.trim()
    };
  });

  return {
    findings: normalizedFindings,
    warnings,
    confidencePenalty
  };
}

export interface AnalyzeRepositoryContextInput {
  rootDir?: string;
  snapshot?: RepoScanSnapshot;
  semanticPatternHint?: RepoPattern;
  unknownThreshold?: number;
  maxFiles?: number;
}

export function analyzeRepositoryContext(input: AnalyzeRepositoryContextInput = {}): RepoAnalysisResult {
  const rootDir = input.rootDir ?? process.cwd();
  const snapshot = input.snapshot ?? buildRepoScanSnapshot(rootDir, input.maxFiles ?? DEFAULT_MAX_FILES);
  const unknownThreshold = input.unknownThreshold ?? 0.5;

  const frameworkFinding = detectFrameworkFinding(snapshot);
  const patternResult = detectPatternClassification({
    snapshot,
    semanticHint: input.semanticPatternHint
  });
  const reuseResult = detectReuseCandidates(snapshot);

  const unknownFallback = applyUnknownFallback(
    [frameworkFinding, patternResult.finding, reuseResult.finding],
    unknownThreshold,
    'Conservative fallback:'
  );

  const normalizedPattern =
    unknownFallback.findings.find((finding) => finding.id === 'pattern-detector')?.result === 'unknown'
      ? {
          ...patternResult.classification,
          primaryPattern: 'unknown' as const,
          unknownReason: 'Low detector confidence; conservative fallback applied.'
        }
      : patternResult.classification;

  const summary = buildRepoAnalysisSummary({
    frameworkResult: unknownFallback.findings[0]?.result ?? 'unknown',
    pattern: normalizedPattern,
    reuseCandidates: reuseResult.candidates,
    findings: unknownFallback.findings,
    confidencePenalty: unknownFallback.confidencePenalty,
    warnings: [
      ...unknownFallback.warnings,
      ...(reuseResult.candidates.length === 0 ? ['No reuse candidates found during deterministic scan.'] : [])
    ]
  });

  return {
    findings: unknownFallback.findings,
    summary
  };
}
