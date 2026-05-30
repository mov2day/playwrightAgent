import type {
  AnalyzerEvidence,
  AnalyzerFinding,
  PatternClassification,
  RepoPattern,
  RepoScanSnapshot
} from '../contracts';

export interface PatternScore {
  pattern: RepoPattern;
  score: number;
}

export interface PatternDetectionInput {
  snapshot: RepoScanSnapshot;
  semanticHint?: RepoPattern;
}

export interface PatternDetectionResult {
  classification: PatternClassification;
  finding: AnalyzerFinding;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function normalize(score: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return clamp01(score / max);
}

function scorePom(snapshot: RepoScanSnapshot): number {
  let score = 0;
  for (const file of snapshot.files) {
    if (/(^|\/)(pages?|page-objects?)\//i.test(file) || /\.page\.[tj]sx?$/.test(file)) {
      score += 2;
    }
    const content = snapshot.fileContents[file] ?? '';
    if (/class\s+[A-Za-z0-9_]*Page\b/.test(content)) {
      score += 2;
    }
    if (/new\s+[A-Za-z0-9_]*Page\(/.test(content)) {
      score += 1;
    }
  }
  return score;
}

function scoreScreenplay(snapshot: RepoScanSnapshot): number {
  let score = 0;
  for (const file of snapshot.files) {
    if (/(^|\/)(screenplay|tasks?|abilities|interactions|questions|actors?)\//i.test(file)) {
      score += 2;
    }
    const content = snapshot.fileContents[file] ?? '';
    if (/actor\.attemptsTo\(/.test(content)) {
      score += 2;
    }
    if (/performAs\(/.test(content)) {
      score += 1;
    }
  }
  return score;
}

export function resolvePatternTieBreakWithSemanticHint(input: {
  ranking: PatternScore[];
  semanticHint?: RepoPattern;
}): RepoPattern | undefined {
  const [top, second] = input.ranking;
  if (!top || !second || !input.semanticHint) {
    return undefined;
  }
  if (Math.abs(top.score - second.score) <= 0.05) {
    return input.semanticHint;
  }
  return undefined;
}

export function detectPatternClassification(input: PatternDetectionInput): PatternDetectionResult {
  const pomRaw = scorePom(input.snapshot);
  const screenplayRaw = scoreScreenplay(input.snapshot);
  const maxRaw = Math.max(pomRaw, screenplayRaw, 1);

  const pomScore = normalize(pomRaw, maxRaw);
  const screenplayScore = normalize(screenplayRaw, maxRaw);
  const hybridScore = Math.min(pomScore, screenplayScore);
  const unknownScore = pomScore === 0 && screenplayScore === 0 ? 1 : clamp01(1 - Math.max(pomScore, screenplayScore));

  const ranking: PatternScore[] = [
    { pattern: 'pom', score: pomScore },
    { pattern: 'screenplay', score: screenplayScore },
    { pattern: 'hybrid', score: hybridScore }
  ].sort((a, b) => b.score - a.score);

  let primaryPattern: RepoPattern;
  let tieBreakUsed = false;

  if (hybridScore >= 0.5) {
    primaryPattern = 'hybrid';
  } else {
    const tiedPattern = resolvePatternTieBreakWithSemanticHint({
      ranking,
      semanticHint: input.semanticHint
    });

    if (tiedPattern) {
      primaryPattern = tiedPattern;
      tieBreakUsed = true;
    } else {
      primaryPattern = ranking[0]?.score ? ranking[0].pattern : 'unknown';
    }
  }

  if ((ranking[0]?.score ?? 0) < 0.2 && hybridScore < 0.2) {
    primaryPattern = 'unknown';
  }

  const secondaryPatterns = ranking
    .filter((entry) => entry.pattern !== primaryPattern && entry.score >= 0.35)
    .map((entry) => entry.pattern);

  const confidenceByPattern: Record<RepoPattern, number> = {
    pom: pomScore,
    screenplay: screenplayScore,
    hybrid: hybridScore,
    unknown: unknownScore
  };

  const evidence: AnalyzerEvidence[] = [];
  if (pomRaw > 0) {
    evidence.push({ source: 'repo_scan', ref: 'pom-signals', snippet: `pomScore=${pomScore.toFixed(2)}` });
  }
  if (screenplayRaw > 0) {
    evidence.push({ source: 'repo_scan', ref: 'screenplay-signals', snippet: `screenplayScore=${screenplayScore.toFixed(2)}` });
  }

  const classification: PatternClassification = {
    primaryPattern,
    secondaryPatterns,
    confidenceByPattern,
    unknownReason: primaryPattern === 'unknown' ? 'Insufficient repository pattern signals.' : undefined,
    tieBreakUsed
  };

  const finding: AnalyzerFinding = {
    id: 'pattern-detector',
    category: 'pattern',
    result: classification.primaryPattern,
    confidence: confidenceByPattern[classification.primaryPattern],
    evidence,
    notes: 'Pattern classification from deterministic file and content heuristics.',
    unknownReason: classification.unknownReason
  };

  return { classification, finding };
}
