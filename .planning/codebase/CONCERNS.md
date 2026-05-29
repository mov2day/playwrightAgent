# Codebase Concerns

**Analysis Date:** 2026-05-29

## Tech Debt

**No lockfile / dependency drift risk:**
- Issue: `skills/playwright-skill/` has `package.json` but no lockfile
- Why: likely early-stage package setup
- Impact: install reproducibility can vary across machines and over time
- Fix approach: commit `package-lock.json` (or chosen lockfile) and pin critical versions

**Documentation and runtime split without validation bridge:**
- Issue: strong architecture/process docs exist, but runtime code does not enforce those gates
- Why: repo currently represents skill assets more than full extension implementation
- Impact: behavior can drift between documented flow and executable behavior
- Fix approach: add executable checks or tests that assert key documented invariants

## Known Bugs

**Potentially stale temp scripts until next run:**
- Symptoms: `.temp-execution-*.js` files remain if process exits before next cleanup cycle
- Trigger: interrupted runs or crashes after file creation
- Workaround: manual deletion in `skills/playwright-skill/`
- Root cause: cleanup runs only at process start (`cleanupOldTempFiles()`)

**Cookie banner helper may miss localized/variant dialogs:**
- Symptoms: consent overlay remains and blocks interactions
- Trigger: site uses non-English button text or non-standard selectors
- Workaround: pass site-specific selectors in scripts
- Root cause: helper uses fixed common selector list

## Security Considerations

**Arbitrary code execution by design:**
- Risk: `run.js` executes untrusted inline/file/stdin JavaScript via generated temp file + `require()`
- Current mitigation: none beyond trusted-user assumption
- Recommendations: document trust boundary explicitly, add optional safe mode or signed-script policy

**Header injection from environment variables:**
- Risk: sensitive headers may be sent to unintended targets if scripts navigate broadly
- Current mitigation: opt-in vars (`PW_HEADER_NAME`/`PW_HEADER_VALUE` or `PW_EXTRA_HEADERS`)
- Recommendations: add domain allowlist controls or per-script opt-out guardrails

## Performance Bottlenecks

**Sequential dev server probing:**
- Problem: `detectDevServers()` checks many ports one by one
- Measurement: no benchmark in repo; expected delay on slow local networks/timeouts
- Cause: serial probe loop with per-port timeout
- Improvement path: parallelize probes with bounded concurrency

**Repeated install path in clean environments:**
- Problem: missing Playwright triggers full `npm install` and browser install
- Measurement: can be multiple minutes on first run
- Cause: install performed during executor startup path
- Improvement path: split install to explicit setup command and fail with actionable message

## Fragile Areas

**Generated wrapper string interpolation:**
- Why fragile: raw user code interpolated into template string in `wrapCodeIfNeeded()`
- Common failures: syntax collisions, accidental template breakage for edge-case snippets
- Safe modification: add parsing/validation step before write, include explicit syntax lint
- Test coverage: none in repo

**Selector strategy in generic helpers:**
- Why fragile: broad fallback selectors in `authenticate()` can match wrong fields/buttons
- Common failures: false positives or wrong element interactions in complex forms
- Safe modification: require explicit selector map for production scenarios
- Test coverage: none in repo

## Scaling Limits

**Repository scope vs enterprise ambition:**
- Current capacity: suitable for local expert users and small-scale script execution
- Limit: lacks CI validation, policy enforcement runtime, and packaged extension runtime here
- Symptoms at limit: inconsistent outcomes across teams/environments
- Scaling path: implement automated validation, release process, and policy-enforced executor

## Dependencies at Risk

**Single critical dependency (`playwright`) with caret range:**
- Risk: minor/patch upgrades may change behavior without lockfile pinning
- Impact: helper behavior and browser compatibility drift
- Migration plan: lock dependency graph and run regression suite on upgrades

## Missing Critical Features

**Automated tests for runtime modules:**
- Problem: helper and executor behavior not regression-tested
- Current workaround: manual runs and ad hoc verification
- Blocks: safe refactoring and confidence in behavior changes
- Implementation complexity: medium

**Policy enforcement aligned with docs:**
- Problem: approval gates and confidence thresholds described in docs are not runtime-enforced in this repo
- Current workaround: manual process discipline
- Blocks: guaranteed enterprise workflow compliance
- Implementation complexity: medium to high

## Test Coverage Gaps

**All runtime JS files untested:**
- What's not tested: `skills/playwright-skill/run.js`, `skills/playwright-skill/lib/helpers.js`
- Risk: regressions in code wrapping, retries, auth helper behavior
- Priority: High
- Difficulty to test: Medium (requires unit + integration harness)

**Doc-to-runtime consistency untested:**
- What's not tested: alignment between `docs/tool.md` policy and executor behavior
- Risk: stakeholder assumes guarantees that code does not enforce
- Priority: Medium
- Difficulty to test: Medium

---

*Concerns audit: 2026-05-29*
*Update as issues are fixed or new risks are identified*
