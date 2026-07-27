# Packaging Hardening (Phase 06)

## Objective

Ship a runtime-only VSIX for `PlaywrightAgent` with explicit exclusion of planning, source, and test artifacts.

## Include/Exclude Policy

### Runtime assets that must be present

- `dist/**` compiled extension runtime
- `package.json` extension manifest/scripts
- `README.md` repository-level product summary
- `skills/**` skill bundle loaded by runtime quality-gate checks
- `docs/tool.md` operator contract reference

### Non-runtime assets explicitly excluded via `.vscodeignore`

- `.planning/**` planning and audit workflow artifacts
- `src/**` TypeScript source (compiled output used instead)
- `tests/**` test-only files
- `.github/**`, `.vscode/**`, `coverage/**`
- config/dev files: `eslint.config.js`, `vitest.config.ts`, `tsconfig*.json`
- local artifacts: `*.vsix`, `.DS_Store`

## Guardrails

- Packaging is blocked until both commands succeed:
  - `npm run compile`
  - `npm run package`
- Any secret-like values discovered in generated artifacts are treated as release blockers.
- Runtime behavior remains governed by mandatory approval gates; packaging hardening does not alter gate semantics.

## Evidence

- Compile: recorded in `RELEASE-CHECKLIST.md`
- Package: recorded in `RELEASE-CHECKLIST.md` with generated VSIX path

