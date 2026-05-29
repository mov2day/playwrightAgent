# Stack Research

**Domain:** VS Code Copilot Chat participant for Playwright test orchestration
**Researched:** 2026-05-29
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.x | Extension code + orchestration logic | Best maintainability for VS Code extensions and strong typing across pipeline stages |
| Node.js | 20 LTS | Runtime for extension backend and local tooling adapters | Stable LTS baseline, good ecosystem support for enterprise extensions |
| VS Code Extension API (Chat Participant API) | Current stable supported by extension `engines.vscode` | `@PlaywrightAgent` participant + slash command integration | Official API supports participant registration, handlers, slash commands, and routing patterns |
| Playwright Test | 1.57+ | Generated test execution, lint/type/run loops | Existing repo already aligned with Playwright skill runtime and best practices |
| Webview UI + Material UI | MUI v9.x | Tabbed plan/review approval UX | Professional component system, fast UI delivery, good long-term support model |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 3.x/4.x | Validation of pipeline payloads (repo profile, ticket context, plan schema) | Required at all gate boundaries to prevent malformed handoffs |
| `pino` | 9.x | Structured audit logs for AI interactions and gate decisions | Required to satisfy “log all AI interactions” constraint |
| `@types/node` | Matching TS/Node baseline | Strong typing in extension service layer | Always with TS extension code |
| `react` + `react-dom` | 18/19 compatible with MUI v9 | Webview panel rendering | Use for tabbed approval UI and grouped test views |
| `@mui/material` | 9.x | UI components for plan tabs, badges, approve/reject controls | Use in webview for professional gate UX |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint + TypeScript ESLint | Static quality checks | Enforce no unsafe writes and pipeline invariants |
| Vitest/Jest (choose one) | Unit tests for orchestration services | Prefer Vitest for speed unless org standard is Jest |
| Playwright HTML report + trace | Debug generated test execution outcomes | Critical for pass/fail diagnostics during run gate |

## Installation

```bash
# Core
npm install @playwright/test zod pino

# Webview UI
npm install react react-dom @mui/material @emotion/react @emotion/styled

# Dev dependencies
npm install -D typescript eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin vitest @types/node
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Chat Participant API | Standalone command palette extension only | If Copilot participant surface unavailable in target environment |
| MUI webview UI | Native VS Code webview HTML only | If strict bundle-size constraints block React/MUI |
| TypeScript service layer | Plain JavaScript | Small prototype only; not ideal for enterprise gate-heavy flow |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Direct AI access to Jira/Confluence secrets | Violates hard security requirement | Local tooling wrappers with env-based secrets |
| Unstructured string payloads between stages | High drift and parsing failures | Typed schemas (`zod`) + explicit stage contracts |
| UI approval gates only in chat text | Poor operator control at scale | Chat + webview dual-channel approvals |

## Stack Patterns by Variant

**If running no-ticket mode:**
- Skip Jira/Confluence adapters
- Keep same validation + confidence pipeline using user context + repo context only

**If ticket mode with deep linked content:**
- Use batched local-tool fetch workers
- Normalize Jira + Confluence into common context DTO before scoring

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@mui/material@9.x` | React 18/19 | Use official peer dependency matrix from MUI docs |
| VS Code Chat Participant API | `engines.vscode` matched extension manifest | Pin minimum VS Code version where chat participant APIs exist |
| `@playwright/test@1.57+` | Node.js 18+ (prefer 20 LTS) | Align with existing repo dependency policy |

## Sources

- https://code.visualstudio.com/api/extension-guides/chat
- https://code.visualstudio.com/api/extension-guides/ai/chat-tutorial
- https://code.visualstudio.com/api/references/contribution-points
- https://code.visualstudio.com/api/get-started/extension-anatomy
- https://playwright.dev/docs/best-practices
- https://playwright.dev/docs/running-tests
- https://mui.com/versions/

---
*Stack research for: VS Code Copilot Playwright orchestration extension*
*Researched: 2026-05-29*
