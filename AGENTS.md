<!-- GSD:project-start source:PROJECT.md -->
## Project

**PlaywrightAgent**

PlaywrightAgent is a VS Code extension feature invoked through a Copilot Chat participant (`@PlaywrightAgent`) to generate enterprise-grade Playwright tests from requirement context. It orchestrates repo analysis, Jira and Confluence context collection, confidence scoring, approval-gated planning/generation, and local test execution. It is designed for QA teams that need production-ready tests with strict governance and traceability.

**Core Value:** Generate accurate, directly runnable Playwright tests with mandatory human approvals and zero secret exposure to the AI model.

### Constraints

- **Tech Stack**: Build as a VS Code extension + Copilot Chat participant; choose best maintainable and extensible architecture
- **Language/Runtime**: Use Node/TypeScript-friendly extension patterns compatible with existing Playwright ecosystem
- **Security**: Jira/Confluence credentials remain in environment variables and local tooling only; never passed to AI prompt context
- **Governance**: Approval gates are mandatory before plan execution and file writes
- **Observability**: All AI interactions must be logged for audit and troubleshooting
- **Write Safety**: Existing spec files must be preserved; updates are append/surgical only
- **Quality Bar**: Generated tests must be executable with no placeholder or speculative behavior
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Markdown - Main project artifacts and skill definitions (`docs/tool.md`, `docs/playwright_agent_architecture.html`, `skills/playwright-skill/*.md`)
- JavaScript (Node.js CommonJS) - Runtime automation executor and helper library (`skills/playwright-skill/run.js`, `skills/playwright-skill/lib/helpers.js`)
- HTML/CSS/JS snippet - Architecture visualization doc (`docs/playwright_agent_architecture.html`)
## Runtime
- Node.js >=14.0.0 (from `skills/playwright-skill/package.json` `engines.node`)
- Playwright browser binaries installed locally by setup script
- npm (scripts defined in `skills/playwright-skill/package.json`)
- Lockfile: none found (`package-lock.json` missing)
## Frameworks
- No app framework (repository is documentation + skill bundle)
- Playwright `^1.57.0` (`skills/playwright-skill/package.json`)
- No transpilation pipeline configured
- Node built-ins used directly (`fs`, `path`, `child_process`, `http`)
## Key Dependencies
- `playwright` `^1.57.0` - Browser automation runtime and APIs
- Node.js built-in modules - file IO, child process execution, local HTTP probing
## Configuration
- Runtime toggles via env vars in helper layer:
- General secrets expected via `.env` style files (project `.gitignore` excludes `.env*`)
- `skills/playwright-skill/package.json` - scripts and dependency metadata
- No separate TypeScript, bundler, or lint config found
## Platform Requirements
- macOS/Linux/Windows with Node.js and npm
- Ability to run `npm install` and `npx playwright install ...`
- Local CLI style usage (`node skills/playwright-skill/run.js ...`)
- Not a deployed web service; consumed as reusable local skill assets
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Documentation files use descriptive uppercase snake or title variants (`SKILL.md`, `API_REFERENCE.md`, `Screenplay_Pattern.md`)
- Runtime JS uses lowercase names (`run.js`, `helpers.js`)
- Generated runtime temp files follow `.temp-execution-<timestamp>.js`
- `camelCase` function names (`checkPlaywrightInstalled`, `wrapCodeIfNeeded`, `retryWithBackoff`)
- Async helpers also use `camelCase` with `async` keyword
- Verb-first names for action utilities (`safeClick`, `safeType`, `takeScreenshot`)
- `camelCase` locals and constants (`defaultOptions`, `maxRetries`, `tempFile`)
- Leading double underscore reserved for internal generated variables in wrapper (`__extraHeaders`)
- Plain JavaScript repo (no native TS type declarations in runtime code)
- JSDoc comments used for lightweight type intent
## Code Style
- 2-space indentation
- Semicolons used consistently
- Single quotes preferred
- Trailing commas mostly omitted in JS objects/arrays
- No ESLint config found
- No Prettier config found
- Style appears manually maintained
## Import Organization
- CommonJS imports at top via `require(...)`
- Node built-ins imported before local helpers
- No ES module syntax in runtime JS
- Standard libraries first (`fs`, `path`, `child_process`, `playwright`)
- Internal modules second (`./lib/helpers` in generated wrapper)
## Error Handling
- Guard clauses with explicit thrown errors (`Invalid browser type`)
- Try/catch at stage boundaries in executor
- Retries for unstable UI actions (`safeClick`, `retryWithBackoff`)
- Console error logging with context, then process exit for fatal conditions
- Non-fatal warnings via `console.warn` in optional parsing branches
## Logging
- Native `console` methods only
- Status messages before major actions (install, execute, detect servers)
- Diagnostic messages on retries and fallback behavior
## Comments
- JSDoc style comments above exported helpers
- Inline comments for execution modes and cleanup rationale
- Developer-oriented usage blocks in markdown docs
- No active TODO comment pattern observed in runtime JS
## Function Design
- Small-to-medium focused functions
- Composable helper utilities (launch, wait, click, type, auth, context)
- Fallback-oriented control flow with graceful degradation where possible
- Options object pattern used heavily (`options = {}`)
- Defaults applied internally to limit call-site complexity
## Module Design
- Single module export object in `lib/helpers.js`
- Named internal functions, exported selectively at bottom
- Runtime orchestrator (`run.js`) separated from reusable browser/page primitives (`lib/helpers.js`)
- Skill guidance split into linked markdown modules (POM, Screenplay, helpers)
## Documentation Conventions
- Skill docs use numbered sections and strict guardrail language
- Linked markdown topology anchored from `SKILL.md`
- External references use explicit Playwright documentation URLs
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Most project value lives in markdown skill definitions and architecture docs
- Runtime layer is a generic executor that runs user supplied Playwright scripts
- Helper library centralizes browser actions and reusable automation utilities
- Repository also contains a nested git repository at `skills/playwright-skill/.git`
## Layers
- Purpose: define behavior, guardrails, and architecture for Playwright-oriented agents
- Contains: `docs/tool.md`, `docs/playwright_agent_architecture.html`, `skills/playwright-skill/*.md`
- Depends on: none at runtime
- Used by: humans and AI orchestration tools
- Purpose: run arbitrary Playwright automation snippets with minimal setup friction
- Contains: `skills/playwright-skill/run.js`
- Depends on: helper layer, Playwright package, Node runtime
- Used by: CLI invocations (`node run.js ...`)
- Purpose: provide reusable automation primitives
- Contains: `skills/playwright-skill/lib/helpers.js`
- Depends on: Playwright browser APIs and Node modules
- Used by: wrapped execution scripts and direct imports
## Data Flow
- Stateless between runs except temporary files
- Temp files are best-effort cleaned at next startup
- No persistent application database or service state
## Key Abstractions
- Purpose: normalize multiple input modes and runtime bootstrapping
- Pattern: procedural orchestrator with guarded stages
- Purpose: abstract common browser and page operations
- Pattern: function library exported via `module.exports`
- Purpose: codify orchestration policy, POM/Screenplay guidance, and references
- Pattern: linked markdown knowledge modules
## Entry Points
- Location: `skills/playwright-skill/run.js`
- Trigger: direct Node CLI execution
- Responsibilities: install checks, code ingestion, wrapper generation, execution
- Location: `skills/playwright-skill/SKILL.md`
- Trigger: skill-aware AI runtime invocation
- Responsibilities: route to specialized sub-skills and enforce workflow gates
## Error Handling
- dependency install failures surface explicit remediation command
- execution errors print message + stack trace
- helper utilities throw for invalid browser type or repeated action failure
## Cross-Cutting Concerns
- Console output with status messages and emoji markers
- Environment variables influence headers, headless mode, slow motion, locale/timezone defaults
- No built-in sandbox for user supplied automation code
- design assumes trusted operator input
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
