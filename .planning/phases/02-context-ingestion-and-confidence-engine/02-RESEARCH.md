# Phase 2: Context Ingestion and Confidence Engine - Research

**Researched:** 2026-05-30
**Domain:** Repository analysis + secure Jira/Confluence ingestion + explainable confidence gating
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Repo analyzer outputs typed finding records (`id`, `category`, `result`, `confidence`, `evidence[]`, `notes`) plus run summary.
- **D-02:** Pattern classification is multi-label with `primaryPattern`, `secondaryPatterns[]`, and per-pattern confidence.
- **D-03:** Reuse detection is deterministic-first (import/export graph, naming, path heuristics), AI semantic pass only as tie-breaker.
- **D-04:** Low analyzer confidence is non-blocking; mark uncertain findings as `unknown`, apply confidence penalty, continue conservatively.
- **D-05:** Jira/Confluence traversal must use global visited-set dedupe with provenance retention.
- **D-06:** Enforce hard caps (`maxIssues`, `maxPages`, `maxEdges`) and emit truncation flags.
- **D-07:** Attachment handling is metadata-first; content extraction only for allowlisted text-friendly types and size-capped.
- **D-08:** Stage-level time budgets + bounded retries with backoff; partial completion must be explicit.
- **D-09:** Jira deep-fetch rules for task/subtask/linked graph and always-linked epic retrieval are mandatory.
- **D-10:** Confluence relevance uses hybrid scoring (lexical + semantic + Jira-link proximity).
- **D-11:** Two-threshold Confluence behavior: `high` bonus, `mid` neutral-visible, `low` excluded.
- **D-12:** Confluence cannot override Jira authority.
- **D-13:** Confluence freshness decay lowers score over age; stale can degrade to neutral.
- **D-14:** Confidence weighting is versioned profile-driven with audit of profile used.
- **D-15:** Gate output must show component score breakdown + reasons + threshold comparisons.
- **D-16:** Evidence shown to users must be sanitized; no secrets/raw auth payloads.
- **D-17:** Gate actions require quick `Continue`/`Cancel` + free-text chat loop.
- **D-18:** Global gate policy fixed: `<40 reject`, `40-70 user gate`, `>70 continue`.
- **D-19:** Jira/Confluence secrets remain local-tooling-only; never sent to model context.
- **D-20:** Ticket and no-ticket `/plan` modes remain first-class.
- **D-21:** All AI interactions require audit logging.

### the agent's Discretion
- Detector/plugin internals and module boundaries.
- Exact normalization formula for score components (within locked gate rules).
- Concrete retry/backoff values and defaults.

### Deferred Ideas (OUT OF SCOPE)
- Extended gate action variants beyond `Continue`/`Cancel`.
- Multi-repo context ingestion and scoring.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Repo analyzer signal extraction | Extension host | File-system adapters | Needs deterministic local scan and typed output |
| Jira graph ingestion | Local tooling adapter | Extension host orchestrator | Secrets stay in env/local process boundary |
| Confluence retrieval + ranking | Local tooling adapter | Context fusion service | Querying via local tooling with relevance filters |
| Confidence scoring + gate decision | Pipeline confidence module | Orchestrator state machine | Must enforce fixed thresholds and explainability |
| User-facing gate payload | Participant handler | Webview/chat action surfaces | Shared explanation contract for both UX surfaces |
| AI interaction auditing | Event sink abstraction | Persistent log sink (later phase) | Must log decisions now, storage hardening later |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 2 should be implemented as four separable but composable subsystems: (1) repo analyzer, (2) Jira ingestion adapter, (3) Confluence ingestion + relevance filtering, and (4) confidence engine + gate integration. The key architecture goal is preserving strict data provenance and confidence explainability while maintaining security boundaries (no secret-bearing payloads in model prompts).

The strongest implementation strategy is contract-first with explicit typed artifacts at every handoff:
- Repo analyzer emits deterministic findings with confidence and evidence provenance.
- Jira and Confluence adapters emit graph-normalized, bounded payloads with completeness metadata.
- Confidence engine consumes only typed artifacts and produces a stable explainability object used at gate-time.

This keeps Phase 2 compatible with later Phase 3 UX, Phase 4 generation scope controls, and Phase 5 audit persistence.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|--------------|---------|---------|--------------|
| TypeScript | 5.x | Typed analyzer/adapter/scoring contracts | Prevents confidence and graph-shape drift |
| Vitest | 2.x | Unit + integration tests for scoring and traversal | Fast verification of edge-heavy logic |
| `zod` | 3.x | Runtime validation for local-tool responses | Defends against malformed tool output |
| `pino` | 9.x | Structured audit event logging | Request-scoped traceability with redaction hooks |

### Supporting
| Library/Tool | Version | Purpose | When to Use |
|--------------|---------|---------|-------------|
| Node child process APIs | built-in | Invoke local Jira/Confluence tooling safely | Adapter layer only |
| `AbortController` | built-in | Stage time budgets and cancellation | All network/tooling stages |
| `crypto` | built-in | Stable hash IDs for evidence/provenance keys | Dedupe and audit correlation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Weighted deterministic confidence engine | LLM-only score synthesis | Less explainable and less reproducible |
| Global visited-set traversal | Recursive deep walk with depth-only cap | Higher cycle risk and duplicate fetch churn |
| Hybrid relevance scoring | Semantic-only ranking | Misses strong lexical/linked-graph intent signals |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### System Architecture Diagram

```text
/plan request
  -> RequestContext (requestId, mode, user context)
  -> RepoAnalyzer
  -> JiraContextBuilder (local-tool adapter + traversal policy)
  -> ConfluenceContextBuilder (query synthesis + relevance scoring)
  -> ConfidenceEngine (component scores + threshold policy)
  -> GateDecision payload (Continue/Cancel + free-text)
  -> Orchestrator transition + EventSink audit trail
```

### Recommended Module Layout
```text
src/
├── adapters/
│   ├── localToolRunner.ts
│   ├── jiraClient.ts
│   ├── jiraGraphTraversal.ts
│   ├── jiraAttachmentPolicy.ts
│   └── confluenceClient.ts
├── pipeline/
│   ├── repoAnalysis/
│   │   ├── contracts.ts
│   │   ├── detectors/
│   │   │   ├── frameworkDetector.ts
│   │   │   ├── patternDetector.ts
│   │   │   └── reuseDetector.ts
│   │   ├── repoAnalyzer.ts
│   │   └── summary.ts
│   ├── context/
│   │   ├── jiraContextBuilder.ts
│   │   ├── confluenceQueryBuilder.ts
│   │   ├── confluenceRelevance.ts
│   │   └── confluenceContextBuilder.ts
│   └── confidence/
│       ├── confidenceContracts.ts
│       ├── confidenceEngine.ts
│       └── explainability.ts
```

### Pattern 1: Evidence-Carrying Findings
Every analyzer/adapter output carries provenance (`source`, `entityId`, `timestamp`, `confidence`, `completeness`) so confidence explanations can reference concrete artifacts.

### Pattern 2: Bounded Graph Expansion
Traversal logic uses global visited sets, hard caps, and stage timeout envelopes to prevent unbounded expansion while retaining deterministic behavior.

### Pattern 3: Layered Confidence Composition
Component score calculators remain isolated (`repo`, `jira`, `confluence`, `user_context`) and are combined by profile-driven weight composition.

### Pattern 4: Sanitization Before Presentation
Evidence payloads are filtered through a redaction/sanitization utility before gate rendering and audit persistence.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool response shape checks | ad-hoc `if` trees per adapter | centralized `zod` validators | Consistent failure handling + safer parsing |
| Retry logic | copy-pasted loops in each module | shared retry helper with stage budget | Uniform timeout/backoff policy |
| Confluence relevance scoring | opaque one-shot heuristic | weighted scoring function with explainability fields | Enables gate-time rationale and tuning |
| Redaction | string replace in each caller | shared sanitizer utility | Prevents accidental leak regressions |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Over-fetching linked issue graphs
**What goes wrong:** Runs exceed practical latency and generate noisy context.
**How to avoid:** global dedupe + max cap enforcement + completeness flags.

### Pitfall 2: Confluence overpowering Jira context
**What goes wrong:** Weak wiki pages bias confidence and plan direction.
**How to avoid:** augmentation-only rule with low relevance exclusion and mid neutralization.

### Pitfall 3: Non-reproducible confidence scores
**What goes wrong:** Same input yields different gate outcomes across runs.
**How to avoid:** versioned weight profiles and deterministic normalization.

### Pitfall 4: Secret leakage through evidence rendering
**What goes wrong:** gate messages or logs include tokens/header values.
**How to avoid:** strict allowlist presentation model + sanitizer required before serialization.
</common_pitfalls>

<validation_architecture>
## Validation Architecture

### Test Strategy
- **Repo analyzer unit tests:** detector outputs, multi-label classification, unknown fallback behavior.
- **Jira traversal unit tests:** task/subtask/epic linked-graph rules, visited-set dedupe, cap/truncation behavior.
- **Confluence relevance unit tests:** lexical/semantic/proximity scoring, threshold outcomes, freshness decay.
- **Confidence engine unit tests:** profile selection, component aggregation, threshold gate outcomes.
- **Integration tests:** request flow from context ingestion through gate decision with sanitized explainability payload.

### Required Commands
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:integration`

### Verification Targets
1. Repo analysis covers framework/pattern/reuse summary (REPO-01..REPO-04).
2. Jira deep-fetch logic satisfies task/subtask/epic/linked graph expectations (JIRA-01..JIRA-06).
3. Confluence query + relevance filter behavior satisfies additive/neutral policy (CONF-01..CONF-02).
4. Confidence engine enforces fixed gate thresholds with explainable breakdown (CONF-03..CONF-06).
</validation_architecture>

<code_examples>
## Code Examples

### Typed finding envelope
```ts
export interface AnalyzerFinding {
  id: string;
  category: 'framework' | 'pattern' | 'reuse';
  result: string;
  confidence: number;
  evidence: Array<{ source: string; ref: string; snippet?: string }>;
  notes?: string;
}
```

### Gate policy contract
```ts
export interface GateDecision {
  finalScore: number;
  gate: 'reject' | 'approval_required' | 'continue';
  allowedActions: Array<'continue' | 'cancel'>;
  explainability: ConfidenceExplainability;
}
```

### Bounded traversal state
```ts
export interface TraversalState {
  visitedIssues: Set<string>;
  visitedPages: Set<string>;
  edges: Array<{ from: string; to: string; relation: string }>;
  truncated: { issues: boolean; pages: boolean; edges: boolean };
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2026)

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Heuristic-only repo classification | Hybrid deterministic + semantic tie-break | Better consistency with reduced ambiguity |
| Monolithic context scraping | Typed adapter pipelines with bounded traversal | Safer and easier to test |
| Opaque confidence score | Explainable component scoring | Better governance and operator trust |
| Free-form logging | Structured correlation + redaction pipeline | Stronger audit readiness |
</sota_updates>

<open_questions>
## Open Questions

1. **Semantic scoring provider for Confluence relevance**
   - Need final decision on local embedding/rerank implementation source (internal module vs tooling-side output).
2. **Attachment text extraction allowlist**
   - Need final type list defaults (`.txt`, `.md`, `.json`, `.csv`, `.log`, `.xml`) and size limit baseline.
3. **Confidence profile tuning baseline**
   - Need first profile numeric weights finalized before implementation lock.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `.planning/phases/02-context-ingestion-and-confidence-engine/02-CONTEXT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/PROJECT.md`
- `docs/tool.md`
- `docs/playwright_agent_architecture.html`

### Secondary (HIGH confidence)
- `src/pipeline/orchestrator.ts`
- `src/pipeline/stateMachine.ts`
- `src/participant/handler.ts`
- `src/adapters/eventSink.ts`
- `skills/playwright-skill/run.js`
- `skills/playwright-skill/lib/helpers.js`
</sources>

<metadata>
## Metadata

**Research scope:**
- Repo analysis contracts and scoring signal design
- Jira/Confluence secure ingestion and graph traversal rules
- Confidence gating and explainability contract

**Confidence breakdown:**
- Architecture and module boundaries: HIGH
- Security and gating constraints: HIGH
- Implementation sequencing: HIGH
</metadata>
