# Phase 3: Planning UX and Approval Gates - Research

**Researched:** 2026-05-30
**Domain:** Requirement-mapped planning UX, scenario approval workflows, and chat/webview state synchronization
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Each scenario uses one `primaryRequirementId` plus `acceptanceCriteriaIds[]`.
- **D-02:** Risk model is `riskLevel` (`low|medium|high`) + `riskReason` + optional `mitigation`.
- **D-03:** Assertion intent for this phase is narrative summary (not structured assertion objects yet).
- **D-04:** Persist both flat scenario list and precomputed group indexes.
- **D-05:** Webview tabs include `All`, requirement/AC group views, and `Rejected`.
- **D-06:** UX requires per-scenario approval controls plus sticky bulk actions.
- **D-07:** Comments must support both per-scenario and global run levels.
- **D-08:** Webview stack is React + MUI in VS Code webview.
- **D-09:** Visual direction is hybrid: minimalist base + high-end accents + Emil motion discipline + anti-slop guardrails.
- **D-10:** Orchestrator session store is single source of truth for approval state.
- **D-11:** Scenario states are `pending|approved|rejected|needs_revision` with `revisionReason[]`.
- **D-12:** Bulk actions affect pending items only unless explicit force override.
- **D-13:** Use optimistic UI with immediate event sync and orchestrator ack reconciliation.
- **D-14:** Reject sets `needs_revision`, preserves history, and excludes from approved generation scope.
- **D-15:** Free-text comments are classified as `clarification|constraint|bug|new_context` and target `scenario` or `global`.
- **D-16:** Regeneration is targeted to impacted scenarios (not full replan by default).
- **D-17:** Keep quick actions `approve|reject|continue|cancel`, and add `revise` CTA in webview.

### the agent's Discretion
- Type naming and module boundaries for plan/approval DTOs.
- Exact MUI composition and component-level motion details.
- Event payload detail level for telemetry, while preserving deterministic sync semantics.

### Deferred Ideas (OUT OF SCOPE)
- Script generation and file write pipelines (Phase 4 onward).
- Execution retry/fix loops and audit log persistence pipeline (Phase 5 onward).
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Plan scenario contract generation | Extension host pipeline | Participant response formatter | Deterministic requirement mapping and trace fields belong in backend contracts |
| Scenario approval state and transitions | Orchestrator state layer | UI/chat dispatchers | Governance and state legality must be centralized |
| Webview rendering and interaction | Webview client (React + MUI) | Extension host bridge | UI responsiveness local; final state authority remote |
| Chat quick actions and free-text loop | Participant handler | Orchestrator | Chat input is untrusted and must be normalized/classified before state mutation |
| Revision targeting and exclusion logic | Pipeline planning state service | Future generation stage | Approved scope boundary must be canonical before Phase 4 generation |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 3 should be implemented contract-first, then rendered through dual surfaces (chat and webview) that consume the same orchestrator-backed state model. The safest architecture is to treat scenario approvals as first-class entities with explicit lifecycle states and append-only revision history, instead of burying review intent in freeform text.

The strongest implementation path is three linked components: (1) a typed plan contract and scenario indexing layer, (2) a webview review app with grouped tabs and deterministic action dispatch, and (3) orchestration sync logic that reconciles optimistic UI updates against authoritative transitions. This avoids split-brain behavior between chat and webview while preserving governance requirements.

**Primary recommendation:** Build Phase 3 around a single shared approval model (`ScenarioApprovalRecord`) consumed by both participant/chat responses and webview state snapshots, with orchestrator-issued transition events as the only mutation path.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|--------------|---------|---------|--------------|
| TypeScript | 5.x | Plan/approval DTOs and transition-safe state typing | Prevents drift between chat payloads and webview payloads |
| React | 19.x | Webview rendering surface | Proven component/state model for tabbed review UI |
| MUI | 6.x/7.x | Professional tab, list, chip, and action-bar components | Matches required "professional Material" review experience |
| Vitest | 2.x | Contract/state unit tests and integration tests | Fast iterative verification for state sync edge cases |

### Supporting
| Library/Tool | Version | Purpose | When to Use |
|--------------|---------|---------|-------------|
| VS Code Webview API | stable | Bridge messages between extension host and webview | Required for action dispatch + state snapshot updates |
| `zod` | 3.x/4.x | Runtime validation for inbound webview/chat action payloads | Protect transition layer from malformed messages |
| Existing event sink abstraction | current repo | Request-scoped action/revision telemetry | Preserve auditability and replay diagnostics |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MUI review panel | Custom CSS-only shell | Lighter bundle, but slower to deliver robust grouped controls |
| Optimistic + reconcile sync | Ack-first only | Simpler correctness, but visibly slower UX at gate interactions |
| Precomputed group indexes | Runtime grouping per render | Fewer persisted fields, but costlier repeated transforms and weaker determinism |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### System Architecture Diagram

```text
/context + /research + /requirements
  -> Plan Contract Builder (scenarios + mapping + risk + assertion summary)
  -> Scenario Indexer (flat list + grouped indexes)
  -> Orchestrator Session Store (authoritative scenario approval state)
     -> Participant Chat Surface (quick actions + free-text)
     -> Webview Surface (tabs, per-item controls, bulk bar, comments)
  -> Transition Event Stream (action, actor, state_delta, requestId)
  -> Scope Filter Output (approved-only set for Phase 4 generation)
```

### Recommended Project Structure
```text
src/
├── pipeline/
│   ├── planning/
│   │   ├── planContracts.ts
│   │   ├── scenarioMapper.ts
│   │   ├── scenarioGrouping.ts
│   │   └── approvalScope.ts
│   └── orchestrator.ts (extended with scenario-level approval records)
├── participant/
│   ├── handler.ts (extended gate/revision message shaping)
│   └── actions.ts
├── ui/
│   ├── planReviewShell.ts
│   ├── reviewModel.ts
│   └── reviewActions.ts
└── tests/
    ├── unit/
    ├── integration/
    └── smoke/
```

### Pattern 1: Canonical Scenario Approval Record
**What:** One typed record per scenario carries state, reasons, comments, and revision history pointers.
**When to use:** Any approval/rejection/revise action path.

### Pattern 2: Action Normalization Before Transition
**What:** Normalize chat and webview actions into one internal command envelope before state transition.
**When to use:** Multi-surface controls with identical semantics.

### Pattern 3: Deterministic Group Index Caching
**What:** Persist group membership indexes from canonical scenario list and recompute only when scenario list mutates.
**When to use:** Tabs/group views with frequent state toggles.

### Anti-Patterns to Avoid
- Keeping separate approval truth in webview local store and orchestrator store.
- Bulk actions that overwrite explicit per-scenario decisions silently.
- Revision comments without classification/target metadata.
- Full-plan regeneration as default response to a single scenario rejection.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Complex tabbed UI primitives | bespoke tab/panel ARIA behavior | MUI `Tabs`, `TabPanel`, `List`, `Chip`, `Drawer/Dialog` primitives | Accessibility and keyboard behavior are already hardened |
| Message payload validation | ad-hoc `if` trees in handlers | shared schema validators (`zod`) for action/comment payloads | Prevents malformed action dispatch and sync bugs |
| Revision history tracking | free-text append blobs | typed `revisionReason[]` + timestamped events | Enables targeted regeneration and traceability |
| Scope filtering logic | per-surface custom filters | centralized `approvedScenarioIds` selector in pipeline layer | Guarantees Phase 4 approved-only generation boundary |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Split-brain state between chat and webview
**What goes wrong:** Chat shows approved while webview still pending (or opposite).
**Why it happens:** Two independent mutation paths with no authoritative reconciliation.
**How to avoid:** Single orchestrator source-of-truth + event-driven snapshot updates.
**Warning signs:** repeated manual refresh or mismatched action availability per surface.

### Pitfall 2: Bulk action clobbers explicit decisions
**What goes wrong:** Approve-all/reject-all unexpectedly overwrites hand-reviewed items.
**Why it happens:** bulk applies blindly to all states.
**How to avoid:** bulk defaults to pending-only; force override requires explicit intent.
**Warning signs:** scenario states change without corresponding user-targeted actions.

### Pitfall 3: Revision loops trigger full replans
**What goes wrong:** Small comments cause expensive full plan regeneration and context loss.
**Why it happens:** no impact analysis from comment target/classification.
**How to avoid:** classify comment + target scenario(s) and regenerate only impacted subset.
**Warning signs:** high latency and frequent unrelated scenario churn after minor feedback.
</common_pitfalls>

<validation_architecture>
## Validation Architecture

### Test Strategy
- **Contract unit tests:** scenario mapping DTOs, requirement/AC link coverage, risk/assertion field presence.
- **State machine integration tests:** per-item approve/reject/revise transitions, bulk pending-only semantics, optimistic reconcile behavior.
- **Chat/webview parity tests:** identical action envelope from both surfaces yields identical state result.
- **Scope exclusion tests:** rejected/needs_revision scenarios excluded from approved scope output.

### Required Commands
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:integration`

### Verification Targets
1. Plans include scenario name, risk, assertion intent, and requirement/AC mapping (`PLAN-01`).
2. Chat output structure and quick actions support gate flow and comments (`PLAN-02`, `RUN-04`, `RUN-05`).
3. Webview grouped tabs + per-item + bulk controls are present and wired (`PLAN-03`, `PLAN-04`, `PLAN-05`).
4. Rejected/needs_revision scenarios are excluded from downstream approved scope (`PLAN-06`).
</validation_architecture>

<code_examples>
## Code Examples

### Scenario approval record
```ts
export interface ScenarioApprovalRecord {
  scenarioId: string;
  state: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  revisionReasons: string[];
  comments: Array<{
    target: 'scenario' | 'global';
    classification: 'clarification' | 'constraint' | 'bug' | 'new_context';
    text: string;
    createdAt: string;
  }>;
}
```

### Bulk action guard (pending-only default)
```ts
function applyBulkApprove(records: ScenarioApprovalRecord[]): ScenarioApprovalRecord[] {
  return records.map((record) => (
    record.state === 'pending'
      ? { ...record, state: 'approved' }
      : record
  ));
}
```

### Approved scope selector
```ts
function approvedScenarioIds(records: ScenarioApprovalRecord[]): string[] {
  return records
    .filter((r) => r.state === 'approved')
    .map((r) => r.scenarioId);
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2026)

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single summary-only planning payload | Scenario-granular approval contracts | Better traceability and partial regeneration control |
| UI-only local review state | Centralized pipeline-backed approval state | Fewer desync failures across interaction surfaces |
| Manual comment interpretation | Comment classification + target modeling | Deterministic revision routing and auditability |
</sota_updates>

<open_questions>
## Open Questions (RESOLVED)

1. **Webview bundle strategy**
   - Resolution: use a single review webview bundle for Phase 3 with shared model/action contracts and React + MUI entrypoint.
   - Scope guard: no bundle-splitting or perf micro-optimization in this phase; capture optimization follow-ups in Phase 6 hardening only.
   - Plan impact: aligns to `03-02-PLAN.md` Task 2 (`reviewApp.tsx` + `planReviewShell.ts` host integration).

2. **Revision reason cardinality limits**
   - Resolution: keep full `revisionReason[]` history in-session for Phase 3 with append-only event entries.
   - Scope guard: no truncation/persistence cap introduced in this phase; retention policy belongs to Phase 5 logging/persistence.
   - Plan impact: aligns to `03-03-PLAN.md` Task 1/Task 2 reject+revise lifecycle handling.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `.planning/phases/03-planning-ux-and-approval-gates/03-CONTEXT.md` — locked decisions and constraints.
- `.planning/ROADMAP.md` — phase goal, success criteria, and plan slots.
- `.planning/REQUIREMENTS.md` — `PLAN-01..PLAN-06`, `RUN-04..RUN-05`.
- `src/pipeline/orchestrator.ts` — existing single-session transition model to extend.
- `src/participant/handler.ts` — current quick-action/free-text gate flow.
- `src/ui/planReviewShell.ts` — baseline webview shell entry to evolve.

### Secondary (HIGH confidence)
- `.planning/phases/02-context-ingestion-and-confidence-engine/02-RESEARCH.md` — prior phase contract-first and explainability patterns.
- `.planning/phases/02-context-ingestion-and-confidence-engine/02-PATTERNS.md` — reusable deterministic orchestration patterns.
- `tests/integration/request-correlation.test.ts` — request-scoped event and transition expectations.
- `tests/smoke/webview-shell.test.ts` — current webview rendering smoke expectations.
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: scenario-level planning contracts, approval UX, sync model
- Architecture: orchestrator authority + dual-surface rendering
- Verification: contract/state/sync regression strategy

**Confidence breakdown:**
- Stack recommendation: HIGH
- Architecture pattern fit: HIGH
- Pitfall mitigation: HIGH
- Validation strategy: HIGH

**Research date:** 2026-05-30
**Valid until:** 2026-06-29
</metadata>

---

*Phase: 03-planning-ux-and-approval-gates*
*Research completed: 2026-05-30*
*Ready for planning: yes*
