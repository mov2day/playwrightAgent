# Phase 5: Execution, Retry Loop, and Audit Logging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves alternatives considered.

**Date:** 2026-05-31
**Phase:** 05-execution-retry-loop-and-audit-logging
**Areas discussed:** run trigger and scope, failure report shape, one-shot repair boundary, audit log persistence, gate UX after failed retry

---

## Run Trigger and Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Run generated/updated tests only | Fast scoped verification aligned to current request changes | ✓ |
| Run impacted suite | Broader risk coverage with additional runtime cost | |
| Run full Playwright suite | Max coverage, slowest feedback loop | |

**User's choice:** Use recommended defaults
**Resolved decision:** Default scope = generated/updated tests only; full-suite remains explicit opt-in.

---

## Failure Report Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Concise summary only | Minimal signal, fastest to scan | |
| Root-cause buckets + expandable raw logs | Distinguishes test/app/env while preserving full diagnostics | ✓ |
| Full raw logs attached by default | Maximum detail, noisier UX | |

**User's choice:** Use recommended defaults
**Resolved decision:** Use root-cause grouped summary with expandable raw detail.

---

## One-Shot Repair Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Generated/updated tests only | Preserves strict governance and bounded mutation | ✓ |
| Allow fixtures/helpers too | Larger fix surface, higher unintended-change risk | |
| No auto patch, suggest only | Manual-heavy flow, slower close-loop | |

**User's choice:** Use recommended defaults
**Resolved decision:** Keep Phase 4 D-13 boundary (generated/updated tests only).

---

## Audit Log Persistence Model

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory + chat only | No durable audit history | |
| File-only sink | Durable but weaker live consumption path | |
| Dual sink (memory + file with redaction metadata) | Durable audit + live workflow compatibility | ✓ |

**User's choice:** Use recommended defaults
**Resolved decision:** Dual sink with pre-persistence redaction and traceable metadata.

---

## Gate UX After Failed Retry

| Option | Description | Selected |
|--------|-------------|----------|
| `continue` = rerun scoped tests after manual fix | Clear recovery semantics in blocked gate flow | ✓ |
| `continue` = skip run and accept artifacts | Weakens signal quality for RUN-01/RUN-02 | |
| `continue` = resume from preview gate | Mismatched stage semantics | |

**User's choice:** Use recommended defaults
**Resolved decision:** `continue` reruns same scoped tests after user confirms manual fix.

---

## the agent's Discretion

- Audit schema/version shape and log rotation details.
- Final report rendering layout in chat/webview.

## Deferred Ideas

None.
