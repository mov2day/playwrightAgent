import path from 'node:path';

import type {
  AnalyzerEvidence,
  AnalyzerFinding,
  ReuseCandidate,
  ReuseCandidateKind,
  RepoScanSnapshot
} from '../contracts';

export interface ReuseDetectionResult {
  candidates: ReuseCandidate[];
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

function classifyKind(file: string): ReuseCandidateKind {
  const lowered = file.toLowerCase();
  if (lowered.includes('fixture')) {
    return 'fixture';
  }
  if (lowered.includes('helper')) {
    return 'helper';
  }
  if (lowered.includes('util')) {
    return 'utility';
  }
  if (lowered.includes('task')) {
    return 'task';
  }
  if (lowered.includes('page')) {
    return 'page_object';
  }
  return 'utility';
}

function hasExportSignature(content: string): boolean {
  return /\bexport\s+(const|function|class|type|interface)\b/.test(content)
    || /module\.exports\s*=/.test(content)
    || /exports\.[A-Za-z0-9_]+\s*=/.test(content);
}

function toCandidate(file: string, content: string): ReuseCandidate | undefined {
  const kind = classifyKind(file);
  const exported = hasExportSignature(content);
  const explicitPattern = kind !== 'utility';

  if (!exported && !explicitPattern) {
    return undefined;
  }

  let confidence = 0.4;
  if (exported) {
    confidence += 0.3;
  }
  if (explicitPattern) {
    confidence += 0.2;
  }
  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    confidence += 0.05;
  }

  const evidence: AnalyzerEvidence[] = [{ source: 'repo_file', ref: file }];
  if (exported) {
    evidence.push({ source: 'content_scan', ref: 'export-signature' });
  }

  const baseName = path.basename(file).replace(/\.[^.]+$/, '');

  return {
    id: `reuse-${file.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    kind,
    name: baseName,
    path: file,
    confidence: clamp01(confidence),
    evidence
  };
}

export function detectReuseCandidates(snapshot: RepoScanSnapshot, maxCandidates = 30): ReuseDetectionResult {
  const candidates: ReuseCandidate[] = [];

  for (const file of [...snapshot.files].sort()) {
    const content = snapshot.fileContents[file] ?? '';
    const candidate = toCandidate(file, content);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  const deduped = new Map<string, ReuseCandidate>();
  for (const candidate of candidates) {
    deduped.set(candidate.path, candidate);
  }

  const finalCandidates = [...deduped.values()]
    .sort((a, b) => b.confidence - a.confidence || a.path.localeCompare(b.path))
    .slice(0, maxCandidates);

  const averageConfidence = finalCandidates.length > 0
    ? finalCandidates.reduce((total, candidate) => total + candidate.confidence, 0) / finalCandidates.length
    : 0;

  const finding: AnalyzerFinding = {
    id: 'reuse-detector',
    category: 'reuse',
    result: `${finalCandidates.length}_reuse_candidates`,
    confidence: clamp01(averageConfidence),
    evidence: finalCandidates.slice(0, 5).map((candidate) => ({
      source: 'reuse_candidate',
      ref: candidate.path,
      snippet: candidate.kind
    })),
    notes: 'Reuse candidates ranked by deterministic export and naming heuristics.'
  };

  return {
    candidates: finalCandidates,
    finding
  };
}
