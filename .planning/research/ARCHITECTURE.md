# Architecture Research

**Domain:** VS Code Copilot Playwright orchestration extension
**Researched:** 2026-05-29
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Chat Experience Layer                     │
├─────────────────────────────────────────────────────────────┤
│  @PlaywrightAgent participant + /plan slash command         │
│  Chat quick actions + freeform comments                     │
├─────────────────────────────────────────────────────────────┤
│                    Orchestration Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Repo Analyzer  Context Fetchers  Scorer  Planner           │
│  Generator      Preview Gate      Writer   Runner           │
├─────────────────────────────────────────────────────────────┤
│                 Local Tooling Integration Layer              │
├─────────────────────────────────────────────────────────────┤
│ Jira fetch CLI   Confluence fetch CLI   Git/File adapters   │
├─────────────────────────────────────────────────────────────┤
│                    Persistence & Audit                       │
│  Plan cache, execution logs, AI interaction logs, reports    │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Chat participant controller | Parse user intent, trigger pipeline stages, maintain gate state | VS Code Chat Participant handler |
| Repo analyzer | Detect framework, pattern, helper reuse, safe insertion points | Static analysis service with file indexing |
| Jira adapter (local tool) | Deep issue graph retrieval and normalization | Child-process wrapper around local secure script |
| Confluence adapter (local tool) | Query/gather relevant pages from Jira-derived hints | CQL-based local script wrapper |
| Confidence scorer | Combine context signals and enforce thresholds | Deterministic scoring engine + policy config |
| Planner | Create scenario plan + AC mapping | LLM prompt templates + schema validation |
| Webview reviewer | Present grouped tabs and approvals | React + MUI webview app |
| Generator/Writer | Build approved tests and patch files safely | AST-aware or diff-aware writer service |
| Runner | Lint/type/test and summarize outcomes | Playwright/lint/tsc command adapter |

## Recommended Project Structure

```
src/
├── extension.ts                  # activation + participant registration
├── participant/
│   ├── handler.ts                # chat request entry
│   ├── slash-plan.ts             # /plan intent parsing
│   └── quick-actions.ts          # approve/reject/continue/cancel mapping
├── pipeline/
│   ├── stages/
│   │   ├── repo-analysis.ts
│   │   ├── jira-fetch.ts
│   │   ├── confluence-fetch.ts
│   │   ├── confidence-score.ts
│   │   ├── plan-generate.ts
│   │   ├── test-generate.ts
│   │   ├── preview-gate.ts
│   │   ├── write-files.ts
│   │   └── run-tests.ts
│   └── contracts/
│       ├── context-schema.ts
│       ├── plan-schema.ts
│       └── approval-schema.ts
├── ui/
│   └── webview-plan-review/      # React + MUI app
├── adapters/
│   ├── jira-local-tool.ts
│   ├── confluence-local-tool.ts
│   ├── ai-client.ts
│   └── logger.ts
└── tests/
    ├── unit/
    └── integration/
```

## Architectural Patterns

### Pattern 1: Stage-Gated Pipeline

**What:** each stage has clear input/output schema and explicit gate transitions.
**When to use:** multi-step AI workflows with compliance requirements.
**Trade-offs:** more boilerplate, much safer operations.

### Pattern 2: Tooling Boundary Isolation

**What:** secrets and external API calls remain in local tooling adapter boundary.
**When to use:** strict credential isolation policy.
**Trade-offs:** extra adapter maintenance, strong security guarantees.

### Pattern 3: Dual-Channel Review UX

**What:** same decisions available in chat + rich webview.
**When to use:** high-volume test plans requiring rapid scanning.
**Trade-offs:** maintain two surfaces, better operator control.

## Data Flow

### Request Flow

```
User /plan
  -> Participant handler
  -> Repo analysis
  -> Jira fetch (optional)
  -> Confluence fetch (optional)
  -> Confidence scoring
  -> Plan generation
  -> Gate approval
  -> Test generation
  -> Preview approval
  -> Write + Run
  -> Report
```

### State Management

- Session-scoped pipeline state object per request
- Persisted review decisions and AI audit events
- Immutable snapshots at each gate for replay/debug

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10 tickets/day | Single-process extension pipeline is fine |
| 10-200 tickets/day | Add fetch caching, background queues, bounded concurrency |
| 200+ tickets/day | Move heavy stages to external service while keeping approval UX in extension |

## Anti-Patterns

### Anti-Pattern 1: Freeform-only orchestration

**What people do:** one giant prompt and one giant output.
**Why wrong:** impossible to enforce gates/retries safely.
**Do instead:** structured stage contracts + gating.

### Anti-Pattern 2: Secret-bearing prompt context

**What people do:** pass raw tokens/headers to model.
**Why wrong:** credential leakage risk.
**Do instead:** local tool wrappers with env-based auth.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Jira Cloud | Local CLI wrapper calling Jira REST APIs | Use issue + attachment + link endpoints; never expose creds to AI |
| Confluence Cloud | Local CLI wrapper calling CQL search/content APIs | Bonus context only when relevance score clears threshold |
| Playwright runtime | Local command execution and report parsing | Use repo-native runner config |

## Sources

- https://code.visualstudio.com/api/extension-guides/chat
- https://code.visualstudio.com/api/extension-guides/ai/chat-tutorial
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-attachments/
- https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-search/

---
*Architecture research for: VS Code Copilot Playwright orchestration extension*
*Researched: 2026-05-29*
