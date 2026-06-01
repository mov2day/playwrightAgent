# Phase 6: Stabilization and v1 Readiness - Pattern Map

**Mapped:** 2026-06-01  
**Files analyzed:** 8  
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/adapters/localToolRunner.ts` (modify) | utility | transform | `src/adapters/localToolRunner.ts` | exact |
| `src/adapters/auditFileSink.ts` (modify) | service | file-I/O | `src/adapters/auditFileSink.ts` | exact |
| `src/pipeline/events.ts` (modify) | model | event-driven | `src/pipeline/events.ts` | exact |
| `src/participant/handler.ts` (modify) | controller | request-response | `src/participant/handler.ts` | exact |
| `tests/integration/security-boundary-local-tool-only.test.ts` | test | request-response | `tests/integration/no-ticket-flow.test.ts` | role-match |
| `tests/integration/security-leak-canary.test.ts` | test | file-I/O | `tests/integration/audit-redaction-persistence.test.ts` | role-match |
| `.vscodeignore` | config | package filtering | `package.json` scripts + `npm run package` behavior | partial |
| `.planning/phases/06-stabilization-and-v1-readiness/release/RELEASE-CHECKLIST.md` | documentation | governance | `.planning/phases/05-execution-retry-loop-and-audit-logging/05-VERIFICATION.md` | role-match |

## Pattern Assignments

### `src/adapters/localToolRunner.ts` (utility, transform)

**Analog:** `src/adapters/localToolRunner.ts`

**Pattern:** centralize text sanitization in one exported function and reuse it in all command-result branches.

```ts
export function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret)\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED]');
}
```

Use this shared helper for any new leak-canary verification utilities; do not fork redaction logic.

---

### `src/adapters/auditFileSink.ts` (service, file-I/O)

**Analog:** `src/adapters/auditFileSink.ts`

**Pattern:** recursive redaction + deterministic evidence metadata + append-only NDJSON persistence.

```ts
const redacted = redactSerializable(event, evidence) as PipelineEvent;
return {
  ...redacted,
  schemaVersion: redacted.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
  persistedAt: this.now().toISOString(),
  redactionEvidence: {
    redacted: true,
    fieldCount: evidence.fieldCount,
    appliedRules: [...evidence.appliedRules].sort((left, right) => left.localeCompare(right))
  }
};
```

Any phase-6 leak checks should assert against this persisted format, not alternate log serialization.

---

### `src/pipeline/events.ts` + `src/participant/handler.ts` (event contracts, controller)

**Analogs:** same files

**Pattern:** keep a canonical event envelope and emit via helper function with explicit metadata.

```ts
const event: PipelineEvent = {
  requestId,
  stage,
  action,
  timestamp: now().toISOString(),
  schemaVersion: PIPELINE_EVENT_SCHEMA_VERSION,
  interactionType,
  decisionAction,
  decisionComment,
  confidenceProfileId,
  decisionGate,
  details
};
```

Phase-6 boundary assertions should validate that `details` remain sanitized and correlation fields stay populated.

---

### `tests/integration/*security*.test.ts` (new tests)

**Analogs:** `tests/integration/audit-redaction-persistence.test.ts`, `tests/integration/no-ticket-flow.test.ts`

**Pattern:** deterministic fixed request IDs, deterministic clock injection, and explicit string assertions for redaction/no-leak outcomes.

```ts
const sink = new AuditFileSink({
  rootDir,
  now: () => new Date('2026-06-01T10:00:00.000Z')
});
```

```ts
expect(JSON.stringify(record.details)).not.toContain('super-secret-token');
expect(JSON.stringify(record.details)).toContain('[REDACTED]');
```

Use fixed fixtures and avoid nondeterministic runtime-dependent assertions.

---

### `.vscodeignore` + release docs (config + governance docs)

**Analogs:** VSIX warning output from `npm run package`, phase verification docs.

**Pattern:** enforce reproducible release gate:
1. package hygiene rules in `.vscodeignore` (runtime-only include intent),
2. explicit compile/package command evidence,
3. checklist-driven manual sign-off.

This keeps release readiness auditable and prevents accidental packaging of non-runtime files.
