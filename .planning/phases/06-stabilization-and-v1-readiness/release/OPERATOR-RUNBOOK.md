# PlaywrightAgent Operator Runbook (v1)

## Purpose

Operate `@PlaywrightAgent` in VS Code with secure defaults, mandatory gates, and auditable outcomes.

## Environment Prerequisites

Set credentials in local environment only. Never paste secrets in chat.

- `JIRA_BASE_URL`
- `JIRA_API_KEY`
- `CONFLUENCE_BASE_URL`
- `CONFLUENCE_API_KEY`

Recommended local validation:

```bash
node -e "['JIRA_BASE_URL','JIRA_API_KEY','CONFLUENCE_BASE_URL','CONFLUENCE_API_KEY'].forEach((k)=>console.log(k, process.env[k] ? 'set' : 'missing'))"
```

## Operating Modes

- Ticket mode: `/plan <JIRA-ID> <optional context>`
- No-ticket mode: `/plan <manual requirement context>`

User-supplied context takes precedence when conflicts appear with Jira/Confluence context.

## Approval Gates (No Bypass)

Each gate must be explicitly approved in sequence:

1. Confidence gate (`reject` / `continue` / `cancel` depending on score)
2. Plan approval gate (`approve` / `reject`)
3. Generated test preview gate (`approve` / `reject`)
4. Write guardrail gate (`approve` / `reject` / `continue` / `cancel`)
5. Execution retry/escalation gate (`approve` / `reject` / `continue` / `cancel`)

Hard rule: no test generation, file write, or rerun proceeds without a valid gate action.

## Escalation Semantics

- `continue`: proceed to next allowed action (or rerun same scoped command during execution escalation).
- `approve`: accept proposed output and move forward when transition mapping permits.
- `reject`: terminate current proposal/escalation path.
- `cancel`: stop flow and preserve state for re-entry.

## Audit and Traceability

Primary audit location:

- `.planning/logs/audit/<requestId>.ndjson`

Audit records are schema-versioned (`pipeline_event.v1`) and carry:

- request correlation (`requestId`)
- stage/action metadata
- gate decision metadata (`decisionAction`, `decisionComment`)
- redaction evidence (`redactionEvidence.fieldCount`, `redactionEvidence.appliedRules`)

## Secure Usage Constraints

- Secrets remain local-tool/env-only and are redacted before event emission/persistence.
- Any leak-canary or unredacted secret evidence is a release blocker.
- Single auto-fix retry boundary remains enforced; unresolved failures require operator decision.

## Known v1 Limits

- One auto-fix retry attempt for execution escalation.
- Manual VS Code chat/webview readability checks required for final release sign-off.
- No gate bypass path for any state transition.

