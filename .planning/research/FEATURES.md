# Feature Research

**Domain:** VS Code Copilot Playwright orchestration extension
**Researched:** 2026-05-29
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Chat participant entry (`@PlaywrightAgent`) | Core UX entrypoint in Copilot workflows | LOW | Must register in `package.json` `chatParticipants` |
| Slash command `/plan <ticket> [context]` | Fast deterministic invocation pattern | LOW | Also support no-ticket mode |
| Repo analysis before generation | Prevent framework drift and bad test patterns | MEDIUM | Detect POM/Screenplay/reuse conventions |
| Jira deep fetch via local tooling | Ticket-only flow needs complete requirement graph | HIGH | Include parent/subtask/epic/linked issues/attachments |
| Confluence query + fetch via local tooling | Jira often missing behavioral detail | MEDIUM | Bonus context only when relevant |
| Confidence gate logic | Safety + human control in ambiguous contexts | MEDIUM | `<40` reject, `40-70` approval gate, `>70` continue |
| Plan approval gate (chat + UI) | Required governance before generation | HIGH | Per-test approve/reject + bulk actions |
| Script preview gate before writes | Prevent accidental unsafe file edits | MEDIUM | Show diff previews and accept comments |
| Safe write strategy | Existing tests must never be clobbered | HIGH | append/surgical update only |
| Run generated tests + report | QA expects execution evidence | MEDIUM | include lint/type/test outcome path |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Requirement-to-scenario trace mapping | Clear audit of what each test covers | MEDIUM | Map acceptance criteria -> scenarios |
| Grouped webview plan by functional cluster | Faster review for large plans | MEDIUM | e.g., by epic/feature/AC bucket |
| One-shot retry auto-repair loop | Reduces manual toil but controlled | MEDIUM | Single retry then explicit user decision |
| Logged AI interaction timeline | Compliance-ready operation history | MEDIUM | Include prompts, model stage, decisions, redactions |
| Quick chat actions (`approve/reject/continue/cancel`) | Low-friction gate handling | LOW | Keep freeform comments as override channel |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full autonomous generation without gates | Speed | Violates governance and trust constraints | Keep mandatory blocking approvals |
| Unlimited auto-fix loops | “Self-heal everything” desire | Hidden destructive churn and long runs | Max one retry cycle then user decision |
| AI direct access to API keys/secrets | Simpler implementation | Security breach surface | Local tooling with env-only secret handling |

## Feature Dependencies

```
Participant + Slash Command
    └──requires──> Repo Analysis
                        └──requires──> Context Pipeline (Jira/Confluence/User)
                                              └──requires──> Confidence Scoring
                                                                  └──requires──> Plan Gate
                                                                                      └──requires──> Generation Gate
                                                                                                          └──requires──> Safe Write + Run
```

### Dependency Notes

- **Plan generation requires repo analysis + fused context:** Without both, generated tests drift from project pattern.
- **Generation requires plan approval:** Rejected scenarios never enter generation scope.
- **Write requires preview approval:** prevents accidental mutation in shared spec files.

## MVP Definition

### Launch With (v1)

- [ ] Participant + `/plan` with ticket and no-ticket modes
- [ ] Repo analysis + deep Jira + Confluence enrichment
- [ ] Confidence gate logic with hard reject / approval band / auto-continue
- [ ] Dual plan rendering (chat + MUI webview) with per-test and bulk approvals
- [ ] Generation of approved scenarios only
- [ ] Preview gate + safe file updates + lint/type checks
- [ ] Optional run step with one retry and explicit escalation
- [ ] Full AI interaction logging

### Add After Validation (v1.x)

- [ ] Smarter grouped visual analytics and risk heatmaps
- [ ] Additional auto-remediation recipes per failure class
- [ ] Better batched fetch optimization for very large epics

### Future Consideration (v2+)

- [ ] Multi-repo orchestration support
- [ ] Non-Playwright framework adapters
- [ ] Cross-project governance dashboards

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `/plan` entry + participant | HIGH | LOW | P1 |
| Repo/Jira/Confluence context pipeline | HIGH | HIGH | P1 |
| Confidence gating | HIGH | MEDIUM | P1 |
| Plan + preview approvals | HIGH | HIGH | P1 |
| Safe write + run loop | HIGH | MEDIUM | P1 |
| Grouped visualization enhancements | MEDIUM | MEDIUM | P2 |
| Additional auto-repair heuristics | MEDIUM | MEDIUM | P2 |
| Multi-repo orchestration | LOW (for initial target) | HIGH | P3 |

## Competitor Feature Analysis

| Feature | Typical Internal QA Bots | Generic LLM Test Agents | Our Approach |
|---------|--------------------------|-------------------------|--------------|
| Approval gates | Often partial | Often optional | Mandatory gate chain |
| Secret handling | Varies by team | Often unclear | Local tooling + env-only |
| Repo pattern alignment | Sometimes shallow | Often speculative | explicit analysis first |
| Traceability | limited | limited | acceptance-criteria mapping by scenario |

## Sources

- https://code.visualstudio.com/api/extension-guides/chat
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-attachments/
- https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-search/
- https://playwright.dev/docs/best-practices

---
*Feature research for: VS Code Copilot Playwright orchestration extension*
*Researched: 2026-05-29*
