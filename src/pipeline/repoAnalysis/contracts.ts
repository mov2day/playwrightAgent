export type RepoFindingCategory = 'framework' | 'pattern' | 'reuse';

export type RepoPattern = 'pom' | 'screenplay' | 'hybrid' | 'unknown';

export interface AnalyzerEvidence {
  source: string;
  ref: string;
  snippet?: string;
}

export interface AnalyzerFinding {
  id: string;
  category: RepoFindingCategory;
  result: string;
  confidence: number;
  evidence: AnalyzerEvidence[];
  notes?: string;
  unknownReason?: string;
}

export interface PatternClassification {
  primaryPattern: RepoPattern;
  secondaryPatterns: RepoPattern[];
  confidenceByPattern: Record<RepoPattern, number>;
  unknownReason?: string;
  tieBreakUsed: boolean;
}

export type ReuseCandidateKind = 'fixture' | 'helper' | 'page_object' | 'task' | 'utility';

export interface ReuseCandidate {
  id: string;
  kind: ReuseCandidateKind;
  name: string;
  path: string;
  confidence: number;
  evidence: AnalyzerEvidence[];
}

export interface PackageJsonLike {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface RepoScanSnapshot {
  files: string[];
  fileContents: Record<string, string>;
  packageJson?: PackageJsonLike;
}

export interface RepoAnalysisSummary {
  framework: string;
  pattern: PatternClassification;
  reuseCandidates: ReuseCandidate[];
  overallConfidence: number;
  warnings: string[];
  confidencePenalty: number;
}

export interface RepoAnalysisResult {
  findings: AnalyzerFinding[];
  summary: RepoAnalysisSummary;
}
