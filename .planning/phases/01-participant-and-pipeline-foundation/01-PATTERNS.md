# Phase 1: Participant and Pipeline Foundation - Pattern Map

**Generated:** 2026-05-30
**Phase:** 01-participant-and-pipeline-foundation
**Inputs:** `01-CONTEXT.md`, `01-RESEARCH.md`

## Pattern Summary

The codebase has one executable analog (`skills/playwright-skill/run.js`) and one helper analog (`skills/playwright-skill/lib/helpers.js`). Both favor:
- guard clauses for invalid input
- staged orchestration flow
- explicit error handling with scoped messages
- option-driven helper interfaces

Phase 1 extension files should mirror this style while introducing TypeScript typing and deterministic FSM transitions.

## File-Level Mapping

| Planned File | Role | Data Flow Position | Closest Analog | Pattern to Reuse |
|--------------|------|--------------------|----------------|------------------|
| `src/participant/slashPlanParser.ts` | Pure parser | Chat input -> parse result | `skills/playwright-skill/run.js#getCodeToExecute` | classify inputs by explicit branches, no side effects |
| `src/pipeline/stateMachine.ts` | Gate controller | parse result -> stage transitions | `docs/tool.md` gate rules + `run.js` staged flow | explicit allowed transitions and fail-fast invalid moves |
| `src/pipeline/bootstrapContext.ts` | Request envelope builder | parser output -> request context | `helpers.js` options defaults pattern | normalize defaults once, propagate context consistently |
| `src/adapters/jiraClient.ts` / `confluenceClient.ts` | Interface boundary | pipeline -> local tooling port | `helpers.js` exported utility boundaries | typed interfaces + injectable implementation |
| `src/ui/planReviewShell.ts` | Shell view | pipeline event -> webview placeholder | `docs/playwright_agent_architecture.html` gate visual model | minimal shell now, contract compatibility for phase 3 |
| `tests/unit/*.test.ts` | Unit quality gate | function/module verification | current helper function granularity | focused tests per behavior contract |

## Concrete Code Excerpts (Analog Evidence)

### 1) Branch-first input classification
From `skills/playwright-skill/run.js`:
```js
if (args.length > 0 && fs.existsSync(args[0])) {
  return fs.readFileSync(filePath, 'utf8');
}
if (args.length > 0) {
  return args.join(' ');
}
if (!process.stdin.isTTY) {
  return fs.readFileSync(0, 'utf8');
}
```

Use same approach in `/plan` parser:
- ticket + optional trailing context
- no-ticket with guided context
- invalid-ticket soft-fail path

### 2) Guarded staged execution
From `skills/playwright-skill/run.js`:
```js
if (!checkPlaywrightInstalled()) {
  const installed = installPlaywright();
  if (!installed) {
    process.exit(1);
  }
}
```

Use equivalent guarding for phase transitions:
- deny transition if source state not allowed
- emit structured error event instead of silent fallback

### 3) Options/default normalization
From `skills/playwright-skill/lib/helpers.js`:
```js
const defaultOptions = {
  headless: process.env.HEADLESS !== 'false',
  slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
};
```

Use this pattern in bootstrap/config modules:
- resolve defaults centrally
- avoid per-module ad-hoc env reads

## Pattern Rules for Planner/Executor

1. Parser and FSM modules stay pure and test-first.
2. Participant handler only orchestrates and delegates; no embedded business logic.
3. Every emitted stage event includes `requestId`.
4. Adapter modules expose interfaces plus stubs; real Jira/Confluence wiring deferred to phase 2.
5. Keep webview shell minimal but wired through the same event contracts used by chat actions.

## Anti-Patterns to Reject

- Stateful parser that mutates global request context.
- Boolean gate flags replacing canonical state machine.
- Direct local-tool invocation from participant handler without adapter interface.
- Mixing UI rendering concerns into pipeline transition logic.

---

*Pattern mapping status: complete*
*Ready for planning: yes*
