---
phase: 02
slug: context-ingestion-and-confidence-engine
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-30
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Repository scan boundary | Repo analyzer reads local file graph and emits classification findings used by gates | Source file paths/content snippets (non-secret project data) |
| Local-tooling credential boundary | Jira/Confluence tooling is invoked locally and must not leak credential-bearing output | Tool stdout/stderr/error strings that may contain tokens/secrets |
| Context graph expansion boundary | Jira/Confluence linked traversal and scoring can expand rapidly and influence decision quality | Linked issue/page metadata, comments, snippets, completeness flags |
| Confidence decision boundary | Confidence scoring and gate actions affect orchestration state transitions | Component scores, decision gates, user-visible explainability payloads |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 | Tampering | detector output | mitigate | Typed finding contracts and deterministic detector ordering (`src/pipeline/repoAnalysis/contracts.ts:11`, `src/pipeline/repoAnalysis/repoAnalyzer.ts:164`) | closed |
| T-02-02 | Repudiation | evidence provenance | mitigate | Findings include detector IDs and evidence refs/snippets (`src/pipeline/repoAnalysis/contracts.ts:5`, `src/pipeline/repoAnalysis/detectors/patternDetector.ts:156`) | closed |
| T-02-03 | Denial of service | repo scan breadth | mitigate | Bounded scan scope via file caps and ignored dirs (`src/pipeline/repoAnalysis/repoAnalyzer.ts:15`, `src/pipeline/repoAnalysis/repoAnalyzer.ts:26`) | closed |
| T-02-04 | Information disclosure | local tool invocation | mitigate | Central redaction of token/secret patterns in tool output and errors (`src/adapters/localToolRunner.ts:24`, `src/adapters/jiraClient.ts:1`) | closed |
| T-02-05 | Denial of service | traversal recursion | mitigate | Global visited sets, hard caps, truncation flags, and stage timeout budget (`src/adapters/jiraGraphTraversal.ts:135`, `src/pipeline/context/jiraContextBuilder.ts:231`) | closed |
| T-02-06 | Tampering | linked graph payload | mitigate | Payload normalization and typed graph traversal with provenance edges (`src/adapters/jiraClient.ts:81`, `src/adapters/jiraGraphTraversal.ts:149`) | closed |
| T-02-07 | Tampering | relevance scoring | mitigate | Deterministic weighted scoring with explicit component scores and bucket classification (`src/pipeline/context/confluenceRelevance.ts:38`, `src/pipeline/context/confluenceRelevance.ts:246`) | closed |
| T-02-08 | Information disclosure | page snippets | mitigate | Snippet sanitization and bounded excerpt length before scoring output (`src/pipeline/context/confluenceContextBuilder.ts:38`, `src/pipeline/context/confluenceContextBuilder.ts:53`) | closed |
| T-02-09 | Integrity | Jira/Confluence precedence | mitigate | Augmentation-only policy and high-only scoring contribution (`src/pipeline/context/confluenceRelevance.ts:261`, `src/pipeline/context/confluenceContextBuilder.ts:79`) | closed |
| T-02-10 | Tampering | score composition | mitigate | Versioned weight profile and deterministic threshold logic (`src/pipeline/confidence/confidenceContracts.ts:54`, `src/pipeline/confidence/confidenceEngine.ts:46`) | closed |
| T-02-11 | Information disclosure | explainability payload | mitigate | Explainability sanitizer removes token/header/secret-like content (`src/pipeline/confidence/explainability.ts:23`, `src/pipeline/confidence/explainability.ts:44`) | closed |
| T-02-12 | Elevation of privilege | gate transition actions | mitigate | Approval-required gate maps to continue/cancel actions with controlled transition mapping (`src/participant/handler.ts:21`, `src/pipeline/orchestrator.ts:175`) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-30 | 12 | 12 | 0 | Codex (`$gsd-secure-phase 2`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-30
