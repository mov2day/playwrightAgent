# Coding Conventions

**Analysis Date:** 2026-05-29

## Naming Patterns

**Files:**
- Documentation files use descriptive uppercase snake or title variants (`SKILL.md`, `API_REFERENCE.md`, `Screenplay_Pattern.md`)
- Runtime JS uses lowercase names (`run.js`, `helpers.js`)
- Generated runtime temp files follow `.temp-execution-<timestamp>.js`

**Functions:**
- `camelCase` function names (`checkPlaywrightInstalled`, `wrapCodeIfNeeded`, `retryWithBackoff`)
- Async helpers also use `camelCase` with `async` keyword
- Verb-first names for action utilities (`safeClick`, `safeType`, `takeScreenshot`)

**Variables:**
- `camelCase` locals and constants (`defaultOptions`, `maxRetries`, `tempFile`)
- Leading double underscore reserved for internal generated variables in wrapper (`__extraHeaders`)

**Types:**
- Plain JavaScript repo (no native TS type declarations in runtime code)
- JSDoc comments used for lightweight type intent

## Code Style

**Formatting:**
- 2-space indentation
- Semicolons used consistently
- Single quotes preferred
- Trailing commas mostly omitted in JS objects/arrays

**Linting:**
- No ESLint config found
- No Prettier config found
- Style appears manually maintained

## Import Organization

**Pattern:**
- CommonJS imports at top via `require(...)`
- Node built-ins imported before local helpers
- No ES module syntax in runtime JS

**Grouping:**
- Standard libraries first (`fs`, `path`, `child_process`, `playwright`)
- Internal modules second (`./lib/helpers` in generated wrapper)

## Error Handling

**Patterns:**
- Guard clauses with explicit thrown errors (`Invalid browser type`)
- Try/catch at stage boundaries in executor
- Retries for unstable UI actions (`safeClick`, `retryWithBackoff`)

**Error Output:**
- Console error logging with context, then process exit for fatal conditions
- Non-fatal warnings via `console.warn` in optional parsing branches

## Logging

**Framework:**
- Native `console` methods only

**Patterns:**
- Status messages before major actions (install, execute, detect servers)
- Diagnostic messages on retries and fallback behavior

## Comments

**When used:**
- JSDoc style comments above exported helpers
- Inline comments for execution modes and cleanup rationale
- Developer-oriented usage blocks in markdown docs

**TODO comments:**
- No active TODO comment pattern observed in runtime JS

## Function Design

**Observed style:**
- Small-to-medium focused functions
- Composable helper utilities (launch, wait, click, type, auth, context)
- Fallback-oriented control flow with graceful degradation where possible

**Parameter handling:**
- Options object pattern used heavily (`options = {}`)
- Defaults applied internally to limit call-site complexity

## Module Design

**Exports:**
- Single module export object in `lib/helpers.js`
- Named internal functions, exported selectively at bottom

**Abstraction approach:**
- Runtime orchestrator (`run.js`) separated from reusable browser/page primitives (`lib/helpers.js`)
- Skill guidance split into linked markdown modules (POM, Screenplay, helpers)

## Documentation Conventions

- Skill docs use numbered sections and strict guardrail language
- Linked markdown topology anchored from `SKILL.md`
- External references use explicit Playwright documentation URLs

---

*Convention analysis: 2026-05-29*
*Update when linting/tooling or style rules are introduced*
