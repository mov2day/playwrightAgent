import type {
  AnalyzerEvidence,
  AnalyzerFinding,
  PackageJsonLike,
  RepoScanSnapshot
} from '../contracts';

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function packageHas(packageJson: PackageJsonLike | undefined, name: string): boolean {
  return Boolean(packageJson?.dependencies?.[name] ?? packageJson?.devDependencies?.[name]);
}

export function detectFrameworkFinding(snapshot: RepoScanSnapshot): AnalyzerFinding {
  const evidence: AnalyzerEvidence[] = [];
  const files = snapshot.files;

  const hasTsFiles = files.some((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
  const hasJsFiles = files.some((file) => file.endsWith('.js') || file.endsWith('.jsx'));
  const hasPlaywright = packageHas(snapshot.packageJson, 'playwright') || files.some((file) => /playwright/i.test(file));
  const hasVitest = packageHas(snapshot.packageJson, 'vitest');

  if (hasTsFiles) {
    evidence.push({ source: 'repo_files', ref: '*.ts|*.tsx' });
  }
  if (hasJsFiles) {
    evidence.push({ source: 'repo_files', ref: '*.js|*.jsx' });
  }
  if (hasPlaywright) {
    evidence.push({ source: 'package.json', ref: 'playwright' });
  }
  if (hasVitest) {
    evidence.push({ source: 'package.json', ref: 'vitest' });
  }

  const language = hasTsFiles ? 'typescript' : hasJsFiles ? 'javascript' : 'unknown';
  const framework = hasPlaywright ? 'playwright' : 'test-unknown';
  const result = `${language}-${framework}`;

  let confidence = 0.2;
  if (language !== 'unknown') {
    confidence += 0.35;
  }
  if (hasPlaywright) {
    confidence += 0.3;
  }
  if (hasVitest) {
    confidence += 0.15;
  }

  return {
    id: 'framework-detector',
    category: 'framework',
    result,
    confidence: clamp01(confidence),
    evidence,
    notes: 'Detected from repository file extensions and package dependencies.'
  };
}
