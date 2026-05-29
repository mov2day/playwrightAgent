# Codebase Structure

**Analysis Date:** 2026-05-29

## Directory Layout

```
playwrightAgent/
├── docs/                          # Product scope and architecture documentation
│   ├── tool.md
│   └── playwright_agent_architecture.html
├── skills/                        # Local skill packages
│   └── playwright-skill/
│       ├── SKILL.md               # Primary skill orchestrator doc
│       ├── API_REFERENCE.md       # Extended Playwright patterns
│       ├── PAGE_OBJECT_MODEL_SKILL.md
│       ├── SCREENPLAY_PATTERN_SKILL.md
│       ├── HELPER_FUNCTIONS_SKILL.md
│       ├── Screenplay_Pattern.md
│       ├── package.json           # Skill runtime metadata
│       ├── run.js                 # CLI executor entry point
│       ├── lib/
│       │   └── helpers.js         # Reusable automation helper functions
│       ├── assets/
│       │   └── screenplay.png
│       └── .git/                  # Nested repository metadata
├── .gitignore
└── README.md
```

## Directory Purposes

**`docs/`:**
- Purpose: define enterprise Playwright agent behavior and approval-gated flow
- Contains: markdown + HTML architecture visual
- Key files: `docs/tool.md`, `docs/playwright_agent_architecture.html`

**`skills/playwright-skill/`:**
- Purpose: package reusable Playwright skill docs and runtime executor
- Contains: skill specs, helper code, package metadata, assets
- Key files: `skills/playwright-skill/SKILL.md`, `skills/playwright-skill/run.js`, `skills/playwright-skill/lib/helpers.js`

**`skills/playwright-skill/lib/`:**
- Purpose: shared JavaScript helper implementations
- Contains: `helpers.js`

**`skills/playwright-skill/assets/`:**
- Purpose: static visual assets referenced by docs
- Contains: `screenplay.png`

## Key File Locations

**Entry Points:**
- `skills/playwright-skill/run.js` - executable script runner
- `skills/playwright-skill/SKILL.md` - AI skill orchestration entry

**Configuration:**
- `.gitignore` - ignore rules including `.env*`, `node_modules/`, coverage outputs
- `skills/playwright-skill/package.json` - dependency and script definitions

**Core Logic:**
- `skills/playwright-skill/run.js` - orchestration of input/wrap/execute lifecycle
- `skills/playwright-skill/lib/helpers.js` - automation utility functions

**Documentation:**
- `docs/tool.md` - detailed target behavior for `@PlaywrightAgent`
- `docs/playwright_agent_architecture.html` - visual pipeline explanation

## Naming Conventions

**Files:**
- Mixed conventions:
  - uppercase snake docs (`API_REFERENCE.md`, `SKILL.md`)
  - descriptive lowercase script names (`run.js`, `helpers.js`)
- test naming convention guidance exists in docs but no test files in repo

**Directories:**
- lowercase with hyphen for package folder (`playwright-skill`)
- lowercase plural for top-level collections (`docs`, `skills`)

**Special Patterns:**
- `.temp-execution-<timestamp>.js` generated at runtime by `run.js`
- nested `.git` under `skills/playwright-skill/` implies separate git history

## Where to Add New Code

**New runtime helper:**
- Implementation: `skills/playwright-skill/lib/`
- Export wiring: `skills/playwright-skill/lib/helpers.js` `module.exports`
- Usage integration: `skills/playwright-skill/run.js`

**New skill guidance module:**
- Documentation: `skills/playwright-skill/*.md`
- Cross-link from: `skills/playwright-skill/SKILL.md`

**New architecture/product documentation:**
- Add under: `docs/`

**New tests (when introduced):**
- Suggested path: `skills/playwright-skill/tests/`
- Suggested command wiring: `skills/playwright-skill/package.json` scripts

## Special Directories

**`skills/playwright-skill/.git`:**
- Purpose: nested repository metadata
- Source: existing separate git repo embedded in parent
- Committed in parent repo: yes (directory present), creates multi-repo workspace behavior

**Future `.planning/`:**
- Purpose: generated planning artifacts for GSD workflows
- Source: workflow commands (`$gsd-*`)
- Committed: depends on `.planning/config.json` `commit_docs` setting

---

*Structure analysis: 2026-05-29*
*Update when directory layout or nested repo strategy changes*
