# Phase 3: Planning UX and Approval Gates - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves alternatives considered.

**Date:** 2026-05-30
**Phase:** 03-planning-ux-and-approval-gates
**Areas discussed:** Plan data contract, Webview UX model, Approval state synchronization, Revision loop behavior

---

## Plan Data Contract

| Decision Point | Option | Description | Selected |
|--------|-------------|----------|-----------|
| Scenario mapping shape | A | One `primaryRequirementId` + `acceptanceCriteriaIds[]` | ✓ |
| Scenario mapping shape | B | Strict 1:1 scenario per acceptance criterion | |
| Scenario mapping shape | C | Requirement-only mapping without AC IDs | |
| Risk representation | A | `riskLevel` enum + reason + optional mitigation | ✓ |
| Risk representation | B | Numeric risk score only | |
| Risk representation | C | Free-text risk paragraph only | |
| Assertion intent format | A | Structured assertions array + summary | |
| Assertion intent format | B | Narrative summary only | ✓ |
| Assertion intent format | C | Step list only | |
| Grouping model | A | Flat scenario list + precomputed group indexes | ✓ |
| Grouping model | B | Grouped-only persisted structure | |
| Grouping model | C | Flat-only storage, group at render time | |

**User's choice:** Q1:A, Q2:A, Q3:B, Q4:A
**Notes:** User intentionally chose narrative assertion summary over structured assertion objects for this phase.

---

## Webview UX Model

| Decision Point | Option | Description | Selected |
|--------|-------------|----------|-----------|
| Tab/group structure | A | Tabs: `All`, Requirement/AC groups, `Rejected` | ✓ |
| Tab/group structure | B | Tabs by risk level only | |
| Tab/group structure | C | Single list + filters only | |
| Approve/reject controls | A | Per-scenario actions + sticky bulk action bar | ✓ |
| Approve/reject controls | B | Per-scenario only | |
| Approve/reject controls | C | Bulk-first with drilldown modal | |
| Comment UX | A | Per-scenario + global run comment | ✓ |
| Comment UX | B | Global comment only | |
| Comment UX | C | Per-scenario only | |
| Webview implementation stack | A | React + MUI in VS Code webview | ✓ |
| Webview implementation stack | B | Vanilla HTML/CSS/JS | |
| Webview implementation stack | C | Svelte webview app | |

**User's choice:** Q1:A, Q2:A, Q3:A, Q4:A
**Notes:** User added explicit design directive to apply local skills `emil-design-eng`, `design-taste-frontend`, `high-end-visual-design`, and `minimalist-ui`, then selected hybrid style balancing all four.

---

## Approval State Synchronization (Chat and Webview)

| Decision Point | Option | Description | Selected |
|--------|-------------|----------|-----------|
| Source of truth | A | Orchestrator session store is single source of truth | ✓ |
| Source of truth | B | Webview-local truth mirrored to chat | |
| Source of truth | C | Dual truth with conflict resolver | |
| Scenario state model | A | `pending|approved|rejected|needs_revision` + `revisionReason[]` | ✓ |
| Scenario state model | B | Binary `approved|rejected` only | |
| Scenario state model | C | Tri-state without revision reasons | |
| Bulk action semantics | A | Bulk applies to pending only; preserve explicit per-item | ✓ |
| Bulk action semantics | B | Bulk overwrites all items | |
| Bulk action semantics | C | Confirm-each-group flow | |
| Consistency timing | A | Optimistic UI + immediate sync + orchestrator reconcile | ✓ |
| Consistency timing | B | Ack-first only | |
| Consistency timing | C | Polling-only consistency | |

**User's choice:** Q1:A, Q2:A, Q3:A, Q4:A
**Notes:** User preference strongly favors deterministic sync with fast UI feedback and non-destructive bulk behavior.

---

## Revision Loop Behavior

| Decision Point | Option | Description | Selected |
|--------|-------------|----------|-----------|
| Reject behavior | A | Mark `needs_revision`, keep history, exclude until re-approved | ✓ |
| Reject behavior | B | Hard delete scenario | |
| Reject behavior | C | Keep rejected but still generate draft stub | |
| Free-text routing | A | Classify comment + attach target (`scenario` or `global`) | ✓ |
| Free-text routing | B | Raw comment blob only | |
| Free-text routing | C | Global comments only | |
| Replan trigger policy | A | Targeted regeneration for impacted scenarios only | ✓ |
| Replan trigger policy | B | Full plan regenerate every time | |
| Replan trigger policy | C | Manual-only regenerate trigger | |
| Gate actions at revision stage | A | Keep quick actions + add explicit `revise` CTA | ✓ |
| Gate actions at revision stage | B | Only approve/reject | |
| Gate actions at revision stage | C | Free text only | |

**User's choice:** Q1:A, Q2:A, Q3:A, Q4:A
**Notes:** Revision loop is intentionally auditable and constrained: targeted regenerate, preserved decision trail, and explicit operator controls.

---

## the agent's Discretion

- Exact DTO/type names for scenario approval entities.
- MUI component decomposition details.
- Fine-grained event payload shape for sync telemetry.

## Deferred Ideas

None.
