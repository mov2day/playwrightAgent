# External Integrations

**Analysis Date:** 2026-05-29

## APIs and External Services

**Automation Targets (dynamic):**
- Arbitrary web applications visited by Playwright scripts
  - Integration method: Playwright browser automation (`page.goto(...)`, selectors, interactions)
  - Auth: defined per executed script or environment variables
  - Endpoints used: user provided at runtime

**Package Registry:**
- npm registry
  - Usage: dependency install in `skills/playwright-skill/package.json` scripts
  - Commands: `npm install`, `npx playwright install chromium`, `npx playwright install chromium firefox webkit`

## Data Storage

**Databases:**
- None integrated in repository code

**File Storage:**
- Local filesystem only
  - Temporary execution scripts created in `skills/playwright-skill/.temp-execution-<timestamp>.js`
  - Screenshots saved to current working directory by helper `takeScreenshot()`

**Caching:**
- None implemented

## Authentication and Identity

**Auth Provider:**
- None built into repository
- `authenticate()` helper supports generic username/password form automation in target applications

**OAuth Integrations:**
- None in repository code

## Monitoring and Observability

**Error Tracking:**
- None (console-only error output in `skills/playwright-skill/run.js`)

**Analytics:**
- None

**Logs:**
- Console logging only (`console.log`, `console.error`, `console.warn`)

## CI/CD and Deployment

**Hosting:**
- None (local skill/tooling repository)

**CI Pipeline:**
- No `.github/workflows/` found in current repository snapshot

## Environment Configuration

**Development:**
- Optional env vars for browser behavior and header injection (`HEADLESS`, `SLOW_MO`, `PW_HEADER_*`, `PW_EXTRA_HEADERS`)
- `.env` files excluded by root `.gitignore`

**Staging:**
- Not defined

**Production:**
- Not defined

## Webhooks and Callbacks

**Incoming:**
- None

**Outgoing:**
- None in repository code

## Local Network Probing

- `detectDevServers()` helper checks common localhost ports (`3000`, `3001`, `3002`, `5173`, `8080`, `8000`, `4200`, `5000`, `9000`, `1234`)
- Purpose: discover running local apps for automation
- Risk note: assumes localhost reachability and may miss nonstandard host/port setups

---

*Integration audit: 2026-05-29*
*Update when external services or CI are introduced*
