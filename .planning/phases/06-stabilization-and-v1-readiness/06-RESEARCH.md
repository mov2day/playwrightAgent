# Phase 6: Stabilization and v1 Readiness - Research

**Researched:** 2026-06-01  
**Domain:** Secret-boundary verification, leak-proof prompt/audit paths, end-to-end UAT closure, and release packaging readiness  
**Confidence:** HIGH (in-repo evidence), MEDIUM (ecosystem/process guidance)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `SECU-01` and `SECU-02` are release blockers.
- **D-02:** Jira/Confluence credentials must stay local-tool/env only; no model-bound prompt exposure.
- **D-03:** Deterministic leak canary checks are mandatory across prompt/event/audit paths.
- **D-04:** Leak verification is fail-closed.
- **D-05:** UAT must cover both ticket and no-ticket modes plus all mandatory gates.
- **D-06:** Phase 5 human verification (real VS Code diagnostics readability) must be closed in Phase 6.
- **D-07:** Release checklist must include successful `npm run compile` and `npm run package`.
- **D-08:** Operator-facing docs must cover setup, safe workflow use, gate semantics, audit location, escalation behavior.
- **D-09:** v1 limits must be explicit (one retry, escalation-required paths, no gate bypass).

### the agent's Discretion
- Exact verification artifact structure and naming.
- Exact UAT checklist format and evidence template.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SECU-01 | Jira/Confluence credentials remain in environment variables consumed by local tooling only. | Keep credential flow constrained to local process boundaries (`spawn` + env inheritance) and never serialize credentials into model-facing event/prompt payloads. [VERIFIED: src/adapters/localToolRunner.ts, src/adapters/jiraClient.ts, src/adapters/confluenceClient.ts, src/participant/handler.ts] [CITED: https://nodejs.org/api/child_process.html] [CITED: https://nodejs.org/api/process.html] |
| SECU-02 | No secrets/tokens are sent to AI model prompts. | Enforce redaction before persistence plus leak-canary tests on interaction payload paths and persisted audit output. [VERIFIED: src/adapters/localToolRunner.ts, src/adapters/auditFileSink.ts, tests/integration/audit-redaction-persistence.test.ts] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html] |
| SC-03 | End-to-end UAT passes for ticket + no-ticket v1 flow. | Reuse existing integration harness and add manual VS Code UAT closure for chat/webview rendering. [VERIFIED: tests/integration/execution-run-flow.test.ts, tests/integration/no-ticket-flow.test.ts, .planning/phases/05-execution-retry-loop-and-audit-logging/05-HUMAN-UAT.md] |
| SC-04 | Release checklist and operator docs are complete. | Add release-readiness bundle with packaging hygiene (`.vscodeignore`/`files`), runbook, and sign-off artifacts. [VERIFIED: package.json, npm run package output 2026-06-01] [CITED: https://code.visualstudio.com/api/working-with-extensions/publishing-extension] [CITED: https://code.visualstudio.com/api/working-with-extensions/bundling-extension] |
</phase_requirements>

## Summary

Phase 6 should be executed as a stabilization envelope around existing Phase 1-5 contracts, not as new feature work:
1. Prove secret isolation boundaries with deterministic canary checks.
2. Prove no leakage in prompt/event/audit surfaces.
3. Close human UAT for real VS Code chat/webview readability and gate behavior.
4. Ship release-readiness docs plus packaging hygiene controls.

**Primary recommendation:** Implement Phase 6 as three parallel tracks with shared evidence output:
- `Track A`: security-boundary verification suite (`SECU-01`, `SECU-02`)
- `Track B`: operator UAT closure (ticket/no-ticket + gate matrix + Phase 5 carry-forward human check)
- `Track C`: release-doc + packaging hardening bundle

This keeps scope bounded while producing auditable release evidence.

## Standard Stack

### Core
| Library/Tool | Current Use | Purpose in Phase 6 | Why Standard |
|--------------|-------------|--------------------|--------------|
| Existing local-tool adapters (`jiraClient`, `confluenceClient`, `localToolRunner`) | In repo | Credential-boundary verification anchors | These are the only approved ingress paths for Jira/Confluence context. [VERIFIED: src/adapters/jiraClient.ts, src/adapters/confluenceClient.ts, src/adapters/localToolRunner.ts] |
| Existing audit sink + event schema (`AuditFileSink`, `PipelineEvent`) | In repo | Leak-proof persistence verification | Already has pre-persist redaction and request-scoped NDJSON durability. [VERIFIED: src/adapters/auditFileSink.ts, src/pipeline/events.ts] [CITED: https://nodejs.org/api/fs.html] |
| Playwright CLI (`npx playwright test ... --reporter=json`) | In repo tests | Deterministic scoped run/UAT evidence | Structured output supports reproducible pass/fail diagnostics and bucketed reporting checks. [VERIFIED: tests/integration/execution-run-flow.test.ts] [CITED: https://playwright.dev/docs/test-cli] [CITED: https://playwright.dev/docs/test-reporters] |
| Vitest integration tests | In repo | Canary and regression guardrails | Existing suite already validates redaction persistence and run-flow contracts. [VERIFIED: tests/integration/audit-redaction-persistence.test.ts, tests/integration/execution-run-flow.test.ts] |
| VS Code Chat/Webview extension APIs | In repo architecture | Human UAT closure path | Chat participant owns end-to-end interaction flow; webview requires explicit security discipline. [VERIFIED: docs/tool.md, src/participant/handler.ts] [CITED: https://code.visualstudio.com/api/extension-guides/chat] [CITED: https://code.visualstudio.com/api/extension-guides/webview] |

### Supporting
| Tooling | Purpose | When to Use |
|---------|---------|-------------|
| `@vscode/vsce` packaging workflow | Build release VSIX and validate included artifacts | Mandatory in release checklist (`npm run package`). [VERIFIED: package.json, npm run package output 2026-06-01] [CITED: https://code.visualstudio.com/api/working-with-extensions/publishing-extension] |
| `.vscodeignore` or `package.json.files` | Exclude non-runtime artifacts from VSIX | Mandatory packaging-hardening action in this phase due current warning state. [VERIFIED: npm run package output 2026-06-01] [CITED: https://code.visualstudio.com/api/working-with-extensions/publishing-extension] |
| VS Code SecretStorage guidance | Security baseline for extension secret persistence | Use as reference to explain why plaintext workspace/global state is not acceptable for secrets. [CITED: https://code.visualstudio.com/api/advanced-topics/remote-extensions] [CITED: https://code.visualstudio.com/api/references/vscode-api] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-repo deterministic canary tests | External secret-scanning SaaS gate | Extra tooling overhead and policy surface area; unnecessary for v1 closeout if in-repo checks are strict and auditable. |
| NDJSON audit files | Database-backed audit store | Better queryability but out of v1 scope and not required by locked decisions. |
| Full-suite mandatory run in every UAT case | Scoped + targeted UAT matrix | Full suite increases noise and runtime; targeted matrix better aligns with phase scope and existing run model. |

## Architecture Patterns

### System Architecture Diagram

```text
Phase 6 Stabilization Envelope

Track A: Secret Boundary Verification
  local-tool adapter invocation
    -> spawn/env boundary assertions
    -> prompt/event payload leak-canary assertions
    -> persisted NDJSON redaction assertions

Track B: End-to-End UAT Closure
  ticket mode + no-ticket mode
    -> confidence gate
    -> plan gate
    -> preview gate
    -> write + guardrail
    -> execution diagnostics readability (chat + webview)

Track C: Release Readiness
  compile/package
    -> packaging hygiene checks (.vscodeignore/files)
    -> operator runbook + checklist + known limits

All tracks emit evidence files -> release sign-off checklist
```

### Recommended Project Structure
```text
.planning/phases/06-stabilization-and-v1-readiness/
├── 06-RESEARCH.md
├── 06-01-PLAN.md                      # security verification tasks
├── 06-02-PLAN.md                      # UAT/docs/readiness tasks
├── 06-HUMAN-UAT.md                    # actual human test execution evidence
├── 06-VERIFICATION.md                 # objective must-have closure report
└── release/
    ├── RELEASE-CHECKLIST.md
    ├── OPERATOR-RUNBOOK.md
    └── PACKAGING-HARDENING.md
```

### Pattern 1: Local-Only Credential Boundary Contract
**What:** Treat environment and local tooling as the only credential boundary; assert no credential keys/values enter model-facing payloads.  
**When:** Every Jira/Confluence fetch and every event/prompt emission path.  
**How:** Add canary assertions around adapter outputs and participant/orchestrator emit payloads.

### Pattern 2: Redaction-First Audit Persistence
**What:** Persist only post-redaction records with deterministic `redactionEvidence`.  
**When:** Every persisted event record.  
**How:** Reuse existing `AuditFileSink` path and extend tests for canary variants.

### Pattern 3: Gate-Matrix UAT (Ticket + No-Ticket)
**What:** Validate both entry modes through all mandatory gates and run outputs.  
**When:** Phase 6 human sign-off and final verification pass.  
**How:** Use existing integration contracts plus manual VS Code execution for UI readability.

### Pattern 4: Packaging Hygiene as Release Gate
**What:** Block release if VSIX includes dev/unnecessary payload (e.g., full `node_modules`, `.planning`, large docs set) without explicit intent.  
**When:** Before marking v1 release-ready.  
**How:** Add `.vscodeignore` or `files` allowlist and rerun packaging.

### Anti-Patterns to Avoid
- Treating redaction as “best effort” warnings instead of fail-closed release criteria.
- Running only headless tests and skipping required human UI diagnostics verification.
- Shipping VSIX without packaging hygiene controls (current package output shows this risk).
- Re-architecting core pipeline/state machine in this phase (scope violation).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret persistence abstraction | Custom plaintext secret file store | VS Code `SecretStorage` guidance where persistence is needed | Platform-supported encrypted storage model and explicit security guidance. [CITED: https://code.visualstudio.com/api/advanced-topics/remote-extensions] |
| Event correlation schema | New ad-hoc event format for Phase 6 | Existing `PipelineEvent` schema + `requestId` correlation | Prevents audit/query drift and keeps replay deterministic. [VERIFIED: src/pipeline/events.ts] |
| Packaging include/exclude logic | Manual post-build pruning scripts | `.vscodeignore` or `package.json.files` allowlist | Official packaging mechanism and reproducible VSIX contents. [CITED: https://code.visualstudio.com/api/working-with-extensions/publishing-extension] |
| Run diagnostics parsing | Regex-only parsing over terminal text | Existing JSON reporter-backed execution path | Structured diagnostics already validated in integration tests. [VERIFIED: tests/integration/execution-run-flow.test.ts] [CITED: https://playwright.dev/docs/test-reporters] |

## Common Pitfalls

### Pitfall 1: False sense of security from adapter-only checks
**What goes wrong:** Adapter code is clean, but leakage still occurs in event/prompt serialization paths.  
**Avoid:** Add canary assertions at participant/orchestrator emit boundaries and persisted audit artifacts.

### Pitfall 2: Redaction checks miss nested fields
**What goes wrong:** Top-level fields are redacted, nested objects leak secrets.  
**Avoid:** Keep recursive serialization redaction checks and expand canary fixtures for deep nesting.

### Pitfall 3: Human UAT left “pending”
**What goes wrong:** Automated tests pass but UI/operator behavior remains unverified.  
**Avoid:** Force closure of `05-HUMAN-UAT.md` carry-over item inside Phase 6 exit criteria.

### Pitfall 4: VSIX bloat and accidental artifact leakage
**What goes wrong:** Package contains large or non-runtime files, increasing risk and install overhead.  
**Avoid:** Treat packaging warnings as release blockers and enforce inclusion policy.

### Pitfall 5: Serial-mode dependency in reliability checks
**What goes wrong:** Suite appears stable only in serial mode and masks isolation issues.  
**Avoid:** Keep tests isolated and retries bounded; use serial only when dependencies are explicit. [CITED: https://playwright.dev/docs/test-retries]

## Validation Architecture

### Test Strategy
- **Unit/integration security checks:** Add leak-canary coverage that verifies redaction and zero secret passthrough in model/event/audit payload paths.
- **Contract tests:** Preserve request-correlation and gate-event schema guarantees while adding canary assertions.
- **UAT matrix:** Validate ticket + no-ticket flows through all mandatory gates and execution decision semantics.
- **Release packaging checks:** Treat `npm run compile` and `npm run package` as release gates, then verify VSIX inclusion hygiene.

### Required Commands
- `npm run lint`
- `npm run typecheck`
- `npm run test -- tests/integration/audit-redaction-persistence.test.ts tests/integration/audit-persistence-request-correlation.test.ts tests/integration/no-ticket-flow.test.ts tests/integration/execution-run-flow.test.ts`
- `npm run compile`
- `npm run package`

### Verification Targets
1. No credential/token value appears in model-facing prompt/event payload surfaces (`SECU-02`).
2. Persisted audit files remain redacted and include deterministic redaction evidence (`SECU-02`, `SECU-04 carry-forward`).
3. Credential acquisition boundaries remain local-tool/env-only (`SECU-01`).
4. Human UAT closes chat/webview diagnostics readability and gate UX carry-over from Phase 5.
5. Release artifacts and operator docs are complete and reproducible.

## Code Examples

### 1) Leak-canary assertion on persisted audit record
```typescript
import fs from 'node:fs';

const recordText = fs.readFileSync(auditFilePath, 'utf8');
expect(recordText).not.toContain('super-secret-token');
expect(recordText).toContain('[REDACTED]');
```
[VERIFIED: tests/integration/audit-redaction-persistence.test.ts]

### 2) Local-tool boundary invocation through controlled runner
```typescript
const result = await runLocalToolCommand(
  'node',
  ['scripts/jira-fetch.mjs', '--ticket', ticketId, '--request-id', requestId],
  20_000
);
```
[VERIFIED: src/adapters/jiraClient.ts, src/adapters/localToolRunner.ts]

### 3) Scoped execution command for deterministic UAT evidence
```typescript
const args = ['playwright', 'test', 'tests/e2e/account.spec.ts', '--reporter=json'];
```
[VERIFIED: tests/integration/execution-run-flow.test.ts] [CITED: https://playwright.dev/docs/test-cli]

### 4) Packaging hardening command path
```bash
npm run compile
npm run package
```
[VERIFIED: package.json scripts, command run on 2026-06-01]

## State of the Art

| Prior habit | Current best practice | Impact |
|-------------|-----------------------|--------|
| Treat extension packaging warnings as informational | Treat packaging include/bundle warnings as release-quality defects | Prevents oversized VSIX and accidental artifact exposure. [CITED: https://code.visualstudio.com/api/working-with-extensions/bundling-extension] |
| Rely on freeform chat behavior only | Use chat participant contracts + explicit gate semantics + deterministic audit trails | Improves reproducibility and governance. [CITED: https://code.visualstudio.com/api/extension-guides/chat] |
| Redact logs only at display time | Redact before persistence and assert excluded data classes | Stronger security posture and audit safety. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html] |

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | Existing redaction regex coverage is sufficient for v1 canary set when combined with new verification tests. | Additional token formats could escape detection until expanded. |
| A2 | Packaging-hardening updates (`.vscodeignore` or `files`) can be landed without runtime regressions. | Over-pruning could remove runtime-required assets. |
| A3 | Manual VS Code UAT remains required even with strong integration coverage. | If skipped, release confidence is overstated. |

## Open Questions (to resolve in planning)

1. Should Phase 6 adopt `.vscodeignore`, `package.json.files`, or both for packaging control?
2. Where should release artifacts live long-term (`.planning/phases/06.../release` vs top-level `docs/release`)?
3. Should canary signatures include only current regex classes or additional org-specific secret formats?
