# Technology Stack

**Analysis Date:** 2026-05-29

## Languages

**Primary:**
- Markdown - Main project artifacts and skill definitions (`docs/tool.md`, `docs/playwright_agent_architecture.html`, `skills/playwright-skill/*.md`)

**Secondary:**
- JavaScript (Node.js CommonJS) - Runtime automation executor and helper library (`skills/playwright-skill/run.js`, `skills/playwright-skill/lib/helpers.js`)
- HTML/CSS/JS snippet - Architecture visualization doc (`docs/playwright_agent_architecture.html`)

## Runtime

**Environment:**
- Node.js >=14.0.0 (from `skills/playwright-skill/package.json` `engines.node`)
- Playwright browser binaries installed locally by setup script

**Package Manager:**
- npm (scripts defined in `skills/playwright-skill/package.json`)
- Lockfile: none found (`package-lock.json` missing)

## Frameworks

**Core:**
- No app framework (repository is documentation + skill bundle)

**Testing/Automation:**
- Playwright `^1.57.0` (`skills/playwright-skill/package.json`)

**Build/Dev:**
- No transpilation pipeline configured
- Node built-ins used directly (`fs`, `path`, `child_process`, `http`)

## Key Dependencies

**Critical:**
- `playwright` `^1.57.0` - Browser automation runtime and APIs

**Infrastructure:**
- Node.js built-in modules - file IO, child process execution, local HTTP probing

## Configuration

**Environment:**
- Runtime toggles via env vars in helper layer:
  - `HEADLESS`
  - `SLOW_MO`
  - `PW_HEADER_NAME`
  - `PW_HEADER_VALUE`
  - `PW_EXTRA_HEADERS`
- General secrets expected via `.env` style files (project `.gitignore` excludes `.env*`)

**Build:**
- `skills/playwright-skill/package.json` - scripts and dependency metadata
- No separate TypeScript, bundler, or lint config found

## Platform Requirements

**Development:**
- macOS/Linux/Windows with Node.js and npm
- Ability to run `npm install` and `npx playwright install ...`

**Production/Usage Target:**
- Local CLI style usage (`node skills/playwright-skill/run.js ...`)
- Not a deployed web service; consumed as reusable local skill assets

---

*Stack analysis: 2026-05-29*
*Update after dependency or runtime changes*
