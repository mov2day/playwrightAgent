# Architecture

**Analysis Date:** 2026-05-29

## Pattern Overview

**Overall:** Documentation-first skill repository with a lightweight Node.js executor

**Key Characteristics:**
- Most project value lives in markdown skill definitions and architecture docs
- Runtime layer is a generic executor that runs user supplied Playwright scripts
- Helper library centralizes browser actions and reusable automation utilities
- Repository also contains a nested git repository at `skills/playwright-skill/.git`

## Layers

**Documentation Layer:**
- Purpose: define behavior, guardrails, and architecture for Playwright-oriented agents
- Contains: `docs/tool.md`, `docs/playwright_agent_architecture.html`, `skills/playwright-skill/*.md`
- Depends on: none at runtime
- Used by: humans and AI orchestration tools

**Execution Layer:**
- Purpose: run arbitrary Playwright automation snippets with minimal setup friction
- Contains: `skills/playwright-skill/run.js`
- Depends on: helper layer, Playwright package, Node runtime
- Used by: CLI invocations (`node run.js ...`)

**Helper Layer:**
- Purpose: provide reusable automation primitives
- Contains: `skills/playwright-skill/lib/helpers.js`
- Depends on: Playwright browser APIs and Node modules
- Used by: wrapped execution scripts and direct imports

## Data Flow

**CLI Execution Flow:**

1. User invokes `node skills/playwright-skill/run.js [file|inline|stdin]`
2. Executor moves process CWD to skill directory for module resolution
3. Executor checks `playwright` dependency availability
4. If missing, executor runs `npm install` and browser install command
5. Executor collects code input (file path, inline arg, or stdin)
6. Executor wraps code in async template if needed
7. Executor writes `.temp-execution-<timestamp>.js` under skill directory
8. Node `require()` executes generated file
9. Helper utilities optionally launch browser, create context/page, and run interactions

**State Management:**
- Stateless between runs except temporary files
- Temp files are best-effort cleaned at next startup
- No persistent application database or service state

## Key Abstractions

**Universal Executor (`run.js`):**
- Purpose: normalize multiple input modes and runtime bootstrapping
- Pattern: procedural orchestrator with guarded stages

**Helper Utility Module (`lib/helpers.js`):**
- Purpose: abstract common browser and page operations
- Pattern: function library exported via `module.exports`

**Skill Documents (`*.md`):**
- Purpose: codify orchestration policy, POM/Screenplay guidance, and references
- Pattern: linked markdown knowledge modules

## Entry Points

**Automation Entry:**
- Location: `skills/playwright-skill/run.js`
- Trigger: direct Node CLI execution
- Responsibilities: install checks, code ingestion, wrapper generation, execution

**Documentation Entry:**
- Location: `skills/playwright-skill/SKILL.md`
- Trigger: skill-aware AI runtime invocation
- Responsibilities: route to specialized sub-skills and enforce workflow gates

## Error Handling

**Strategy:** fail fast with console diagnostics and non-zero exits

**Patterns:**
- dependency install failures surface explicit remediation command
- execution errors print message + stack trace
- helper utilities throw for invalid browser type or repeated action failure

## Cross-Cutting Concerns

**Logging:**
- Console output with status messages and emoji markers

**Configuration:**
- Environment variables influence headers, headless mode, slow motion, locale/timezone defaults

**Security Model:**
- No built-in sandbox for user supplied automation code
- design assumes trusted operator input

---

*Architecture analysis: 2026-05-29*
*Update when runtime pattern or layering changes*
