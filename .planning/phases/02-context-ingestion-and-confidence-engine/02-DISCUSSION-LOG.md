# Phase 2: Context Ingestion and Confidence Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 2-context-ingestion-and-confidence-engine
**Areas discussed:** Repo Analyzer Contract, Jira Traversal Limits, Confluence Relevance Policy, Confidence Explainability Payload

---

## Repo Analyzer Contract

### Q1: Finding representation model

| Option | Description | Selected |
|--------|-------------|----------|
| Typed finding records + final summary | Structured detector output (`id/category/result/confidence/evidence/notes`) | ✓ |
| Narrative summary only | Human-readable text only | |
| Boolean flags only | Minimal pattern flags | |
| You decide | Agent discretion | |

**User's choice:** Typed finding records + summary
**Notes:** Chosen for maintainability and downstream machine usability.

### Q2: Mixed-repo pattern classification

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-label classification | `primaryPattern` + `secondaryPatterns[]` + confidence | ✓ |
| Single forced label | One pattern only | |
| `unknown` on conflict | Conflict causes unknown output | |
| You decide | Agent discretion | |

**User's choice:** Multi-label classification
**Notes:** Hybrid repositories are expected and should be modeled directly.

### Q3: Reuse-candidate detection priority

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic-first, AI tie-breaker | graph/naming/path heuristics before semantic AI pass | ✓ |
| AI-first | semantic analysis first | |
| Heuristics only | no semantic AI tie-break | |
| You decide | Agent discretion | |

**User's choice:** Deterministic-first, AI tie-breaker
**Notes:** Preference for stable repeatable behavior before AI arbitration.

### Q4: Low-confidence analyzer behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Continue conservatively + penalty | mark unknowns, continue, apply confidence penalty | ✓ |
| Hard-stop | fail on analyzer ambiguity | |
| Mandatory user hint request | ask user before any continuation | |
| You decide | Agent discretion | |

**User's choice:** Continue conservatively with penalty
**Notes:** Avoid unnecessary hard-fail while preserving safety.

---

## Jira Traversal Limits

### Q1: Cycle and dedupe policy

| Option | Description | Selected |
|--------|-------------|----------|
| Global visited set + provenance | dedupe by normalized keys, keep edge lineage | ✓ |
| Per-branch visited | localized dedupe only | |
| Depth-only | no dedupe, cap depth | |
| You decide | Agent discretion | |

**User's choice:** Global visited set + provenance
**Notes:** Traceability and cycle safety both required.

### Q2: Traversal boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Hard caps + truncation flags | configurable `maxIssues/maxPages/maxEdges` with explicit truncation | ✓ |
| Depth-only cap | no node/page caps | |
| Timeout-only | no hard graph caps | |
| You decide | Agent discretion | |

**User's choice:** Hard caps + truncation flags
**Notes:** Bounded execution is required for predictable runs.

### Q3: Attachment policy

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata-first + allowlisted extraction | only selected text-friendly types under size limits | ✓ |
| Always fetch full attachment content | unrestricted fetch | |
| Ignore attachments | no attachment context | |
| You decide | Agent discretion | |

**User's choice:** Metadata-first + allowlisted extraction
**Notes:** Balances context quality with safety and cost.

### Q4: Timeout and retry policy

| Option | Description | Selected |
|--------|-------------|----------|
| Stage budgets + bounded backoff + partial flags | controlled retries and explicit completeness status | ✓ |
| Fail on first timeout | strict immediate failure | |
| Unlimited retries | unbounded completion attempts | |
| You decide | Agent discretion | |

**User's choice:** Stage budgets + bounded backoff + partial flags
**Notes:** Partial completeness signaling is mandatory for explainability.

---

## Confluence Relevance Policy

### Q1: Relevance scoring model

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid weighted model | lexical + semantic + Jira-link proximity | ✓ |
| Semantic-only | only embedding/semantic score | |
| Keyword-only | lexical terms only | |
| You decide | Agent discretion | |

**User's choice:** Hybrid weighted model
**Notes:** Multiple signal classes required for reliable ranking.

### Q2: Threshold behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Two-threshold model | `high` bonus, `mid` neutral-visible, `low` excluded | ✓ |
| Single threshold | include/exclude only | |
| Include everything | planner filters later | |
| You decide | Agent discretion | |

**User's choice:** Two-threshold model
**Notes:** Aligns with neutral handling for weak signals.

### Q3: Jira vs Confluence precedence

| Option | Description | Selected |
|--------|-------------|----------|
| Augmentation-only | Confluence never overrides Jira | ✓ |
| High-confidence override | Confluence may override Jira | |
| Override with per-run approval | manual override path | |
| You decide | Agent discretion | |

**User's choice:** Augmentation-only
**Notes:** Jira remains authoritative primary context source.

### Q4: Stale content handling

| Option | Description | Selected |
|--------|-------------|----------|
| Freshness decay | age penalty can drop bonus to neutral | ✓ |
| Ignore freshness | no age signal | |
| Hard age cutoff | fixed-date exclusion | |
| You decide | Agent discretion | |

**User's choice:** Freshness decay
**Notes:** Avoid brittle fixed exclusion while still reducing stale impact.

---

## Confidence Explainability Payload

### Q1: Score weight management

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned profile + overrides + audit | config profile (`v1-default`) with recorded runtime profile | ✓ |
| Hardcoded weights only | source-code-only constants | |
| AI-decided per run | dynamic weighting each run | |
| You decide | Agent discretion | |

**User's choice:** Versioned profile + overrides + audit
**Notes:** Supports controlled evolution and traceability.

### Q2: Gate-time explanation detail

| Option | Description | Selected |
|--------|-------------|----------|
| Full component breakdown | per-component score + reasons + threshold comparison | ✓ |
| Final score only | no component detail | |
| Final score + one line | short reason only | |
| You decide | Agent discretion | |

**User's choice:** Full component breakdown
**Notes:** Required for explainable gate behavior.

### Q3: Evidence visibility policy

| Option | Description | Selected |
|--------|-------------|----------|
| Sanitized evidence references | IDs/keys/snippets only, no secrets/raw auth data | ✓ |
| No evidence shown | rationale only | |
| Full raw payload | include full details | |
| You decide | Agent discretion | |

**User's choice:** Sanitized evidence references
**Notes:** Security boundary preserved while keeping explainability.

### Q4: `40-70` gate action payload

| Option | Description | Selected |
|--------|-------------|----------|
| Continue + Cancel + optional needs-more-context hints | quick actions plus guided hints | |
| Continue/Cancel only | quick actions only | |
| Continue + forced comment | mandatory user comment | |
| Custom gate UX | Continue + Cancel quick options plus free-text chat instructions/context | ✓ |

**User's choice:** Continue + Cancel quick options + free-text chat option for instructions or additional context
**Notes:** Free-text correction/enrichment loop must be always available.

---

## the agent's Discretion

- Detector registry implementation details and internal class/module split.
- Numeric defaults for cap values and retry parameters (within configured bounds).
- Exact event payload key naming for explainability internals.

## Deferred Ideas

- Expanded gate action permutations beyond Continue/Cancel are deferred until planning UX-focused phases.

