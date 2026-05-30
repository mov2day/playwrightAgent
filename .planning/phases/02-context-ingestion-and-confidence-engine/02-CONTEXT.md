# Phase 2: Context Ingestion and Confidence Engine - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement repository analysis, secure Jira/Confluence context ingestion, and explainable confidence-gated progression for `/plan` runs. This phase establishes decision-quality scoring and gate behavior that controls whether downstream planning can proceed.

</domain>

<decisions>
## Implementation Decisions

### Repo Analyzer Contract
- **D-01:** Analyzer findings use typed records per detector: `id`, `category`, `result`, `confidence`, `evidence[]`, `notes`, plus a run-level summary payload.
- **D-02:** Pattern classification is multi-label with `primaryPattern`, `secondaryPatterns[]`, and per-pattern confidence (supports hybrid repos).
- **D-03:** Reuse-candidate detection is deterministic-first (`exports/import graph + naming + path heuristics`), with AI semantic analysis only as tie-breaker.
- **D-04:** Low-confidence analyzer output does not hard-stop the run; it marks uncertain findings as `unknown`, applies confidence penalty, and continues with conservative defaults.

### Jira Traversal and Fetch Boundaries
- **D-05:** Graph traversal uses a global visited set keyed by normalized Jira/Confluence identifiers, while preserving edge provenance for traceability.
- **D-06:** Enforce configurable hard caps per run (`maxIssues`, `maxPages`, `maxEdges`) with explicit truncation flags in output.
- **D-07:** Attachment policy is metadata-first; content extraction is restricted to allowlisted text-friendly types with file-size caps.
- **D-08:** Ingestion pipeline uses stage-level time budgets and bounded retries with backoff; partial results are allowed when completeness flags are explicit.
- **D-09:** Jira deep-fetch rules are mandatory and retained as fixed requirements:
  - Task ticket: fetch full details, comments, attachments, linked Jira issues/pages, all subtasks in full.
  - Sub-task ticket: fetch full details, comments, attachments, linked Jira issues/pages, full parent details.
  - Always fetch linked epic details when epic relation exists.

### Confluence Relevance Policy
- **D-10:** Relevance scoring is hybrid: lexical match + semantic match + Jira-link proximity with configurable weighted components.
- **D-11:** Use two-threshold relevance behavior: `high` contributes confidence bonus, `mid` is neutral-visible (available context but non-scoring), `low` excluded.
- **D-12:** Confluence never overrides strong Jira context; Confluence is augmentation-only.
- **D-13:** Freshness decay applies age-based penalty; stale pages can degrade from bonus to neutral rather than forced hard-exclusion.

### Confidence Explainability and Gate UX
- **D-14:** Confidence weights are versioned profiles (e.g., `v1-default`) in config, with runtime override support and profile-used audit logging.
- **D-15:** Gate output includes full component score breakdown (`repo`, `jira`, `confluence`, `user_context`), reasons, and threshold comparison.
- **D-16:** User-facing evidence references are sanitized only (IDs/keys/snippets); never show secrets, tokens, raw auth payloads, or credential-bearing values.
- **D-17:** For gate-band approval flows, quick actions must include `Continue` and `Cancel`, and free-text chat must always remain available for user instructions or extra context before proceeding.

### Carried Forward Constraints
- **D-18:** Core gate policy is fixed and non-negotiable for this phase: `<40 reject`, `40-70 user gate`, `>70 continue`.
- **D-19:** Jira/Confluence credentials remain local-tooling-only and are never shared to model prompts.
- **D-20:** `/plan` ticket and no-ticket modes remain first-class supported inputs.
- **D-21:** All AI interactions are logged for auditability.

### the agent's Discretion
- Exact detector implementation details and detector registry structure.
- Precise scoring normalization formula (as long as D-14/D-15 behavior remains intact).
- Internal retry-backoff parameters within configured bounds.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Requirements
- `.planning/ROADMAP.md` — Phase 2 scope, success criteria, and plan slots (`02-01` to `02-04`).
- `.planning/REQUIREMENTS.md` — Phase 2 requirement IDs (`REPO-*`, `JIRA-*`, `CONF-*`).
- `.planning/PROJECT.md` — global constraints, governance intent, and security posture.

### Product Behavior Contracts
- `docs/tool.md` — authoritative user-facing orchestration and approval-gate behavior.
- `docs/playwright_agent_architecture.html` — pipeline stage model and sequencing reference.

### Existing Extension Integration Surface
- `src/participant/handler.ts` — `/plan` entry handling and initial state/bootstrap events.
- `src/participant/slashPlanParser.ts` — strict ticket/no-ticket parse semantics to preserve.
- `src/pipeline/contracts.ts` — request context contract primitives.
- `src/pipeline/orchestrator.ts` — gate transition orchestration behavior.
- `src/pipeline/stateMachine.ts` — finite-state gate transition constraints.
- `src/adapters/eventSink.ts` — event sink abstraction for observability extension.

### Existing Runtime Patterns and Prior Context
- `.planning/phases/01-participant-and-pipeline-foundation/01-CONTEXT.md` — locked phase-1 foundation decisions to preserve.
- `skills/playwright-skill/run.js` — staged runtime orchestration and guarded execution references.
- `skills/playwright-skill/lib/helpers.js` — helper utility patterns used as reusable style baseline.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/participant/slashPlanParser.ts`: strict ticket parsing and no-ticket fallback behavior already implemented.
- `src/pipeline/bootstrapContext.ts`: request context bootstrap contract with source-tagged user context.
- `src/pipeline/orchestrator.ts` + `src/pipeline/stateMachine.ts`: transition guard foundation to integrate confidence-gate outcomes.
- `src/adapters/eventSink.ts`: event sink interface that can be extended for ingestion/confidence audit events.
- `tests/integration/*` and `tests/unit/*`: test harness pattern already established for incremental phase coverage.

### Established Patterns
- Typed TypeScript contracts and finite-state transition enforcement are preferred over implicit flags.
- Participant flow emits request-scoped structured events with `requestId` propagation.
- Security/non-bypass gate intent is encoded as explicit transition logic, not convention-only behavior.

### Integration Points
- Repo analyzer service should plug into pipeline context stage before plan gate evaluation.
- Jira and Confluence local-tool adapters should sit behind typed adapter contracts in `src/adapters/`.
- Confidence engine should produce explainability payload consumed by participant reply + gate action handlers.
- Event logging extension should hook into existing `EventSink` flow without breaking request-scoped traceability.

</code_context>

<specifics>
## Specific Ideas

- Deep Jira traversal behavior must include full comments/detail retrieval and linked graph expansion according to ticket type, while remaining cycle-safe and bounded.
- Confluence signal quality should never degrade strong Jira context; only relevant high-quality pages may add confidence.
- Gate interactions must remain fast: quick actions for immediate control, plus free-text loop for user corrections/context additions before progression.

</specifics>

<deferred>
## Deferred Ideas

- Additional confidence-band UX variants beyond `Continue`/`Cancel` quick actions are deferred until later UX-focused phases.
- Any broad multi-repo traversal strategy remains outside this phase boundary (already deferred to v2 scope).

</deferred>

---

*Phase: 02-context-ingestion-and-confidence-engine*
*Context gathered: 2026-05-30*
