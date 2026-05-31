# Phase 4: Generation, Preview, and Safe File Writing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves alternatives considered.

**Date:** 2026-05-31
**Phase:** 04-generation-preview-and-safe-file-writing
**Areas discussed:** Generation Packaging, Preview Gate UX, Safe Write Rules, Lint/Type Auto-fix Escalation, Skill Bundle Governance

---

## Generation Packaging

### Q1: Default output layout
| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid | Append to safe match, else create new file | ✓ |
| Always New Files | Never append | |
| Always Append | Never create new file | |

### Q2: Grouping strategy for multiple approved scenarios
| Option | Description | Selected |
|--------|-------------|----------|
| Group by functionality | One spec per functionality area | ✓ |
| Group by requirement ID | One spec per requirement | |
| One scenario per file | One file per scenario | |

### Q3: New file naming
| Option | Description | Selected |
|--------|-------------|----------|
| `<functionality>.spec.ts` | Stable discoverable naming | ✓ |
| `<requirement-id>-<functionality>.spec.ts` | Traceability-heavy naming | |
| `generated-<timestamp>.spec.ts` | Run-unique naming | |

### Q4: Insert location for matched files
| Option | Description | Selected |
|--------|-------------|----------|
| End of existing `describe` block | Minimal structural mutation | ✓ |
| Keyword-near insertion | Locality-first insertion | |
| New describe at file end | Isolated block insertion | |

**User's choice:** Hybrid append/create policy with functionality grouping and stable naming.
**Notes:** Prioritized low-risk append behavior and deterministic file discovery.

---

## Preview Gate UX

### Q1: Preview surfaces
| Option | Description | Selected |
|--------|-------------|----------|
| Both chat + webview | Fast summary + rich diff review | ✓ |
| Webview only | Single rich UI | |
| Chat only | Minimal UI complexity | |

### Q2: Approval granularity
| Option | Description | Selected |
|--------|-------------|----------|
| Global approve-all | One explicit approval gate | ✓ |
| Per-file approvals | File-by-file approval | |
| Per-scenario preview approvals | Scenario-granular approval | |

### Q3: Preview depth
| Option | Description | Selected |
|--------|-------------|----------|
| Structured summary + patch diff | Combined overview + exact change | ✓ |
| Summary only | No exact patch | |
| Raw patch only | No high-level summary | |

### Q4: Comment handling during preview
| Option | Description | Selected |
|--------|-------------|----------|
| Regenerate impacted parts + re-approve | Safety-first refresh | ✓ |
| Notes only, continue | No regeneration gate | |
| Conditional re-approval | Heuristic re-approval | |

**User's choice:** Dual-surface preview with explicit global approval and mandatory re-approval on comment-driven regeneration.
**Notes:** Review certainty before write was prioritized over speed.

---

## Safe Write Rules

### Q1: Unsafe anchor behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Skip file mutation, create new scoped file | Safe fallback | ✓ |
| Append anyway | Best-effort mutation | |
| Abort whole run | Hard all-or-nothing | |

### Q2: Duplicate prevention
| Option | Description | Selected |
|--------|-------------|----------|
| Stable marker IDs + replace/update | Deterministic dedupe | ✓ |
| Text similarity checks | Heuristic dedupe | |
| No dedupe logic | Reviewer catches duplicates | |

### Q3: Mixed safe/blocked files
| Option | Description | Selected |
|--------|-------------|----------|
| Write safe files, skip blocked with report | Partial-safe progression | ✓ |
| Abort all writes | All-or-nothing | |
| Prompt per blocked file first | Interactive per-file gate | |

### Q4: Deletion protection strictness
| Option | Description | Selected |
|--------|-------------|----------|
| Strict no-delete mode | Never remove existing tests/blocks | ✓ |
| Delete generated marker sections only | Controlled delete scope | |
| Allow structural refactors | Broad mutation allowed | |

**User's choice:** Strict safety model with partial-safe writes and explicit reporting.
**Notes:** Existing repo content preservation is non-negotiable.

---

## Lint/Type Auto-fix Escalation

### Q1: Auto-fix retry edit scope
| Option | Description | Selected |
|--------|-------------|----------|
| Generated/updated test files only | Scope-limited repair | ✓ |
| Include shared helper files | Extended repair scope | |
| Any file needed | Broad repair scope | |

### Q2: Escalation detail bundle
| Option | Description | Selected |
|--------|-------------|----------|
| Structured failure bundle | Command + errors + files + attempt summary + actions | ✓ |
| Error text only | Minimal diagnostics | |
| Error text + suggested actions | Partial diagnostics | |

### Q3: Escalation quick actions
| Option | Description | Selected |
|--------|-------------|----------|
| `approve/reject/continue/cancel` + free-text | Gate consistency | ✓ |
| `retry/skip/abort` only | Alternative gate vocabulary | |
| Free-text only | No quick actions | |

### Q4: Run tests when lint/type still fails?
| Option | Description | Selected |
|--------|-------------|----------|
| No, block execution pending user decision | Gate integrity | ✓ |
| Yes, run anyway | Max observability | |
| Ask every time | Runtime branch decision | |

**User's choice:** One scoped auto-fix retry; on failure, escalate with structured diagnostics and block execution until decision.
**Notes:** Maintains predictable governance and avoids noisy downstream failures.

---

## Skill Bundle Governance

### Q1: Bundle content policy for `skills/`
| Option | Description | Selected |
|--------|-------------|----------|
| Strict allowlist | Include required skill docs/assets only; exclude `.git`, `.DS_Store`, temp artifacts | ✓ |
| Full directory minus obvious binaries | Broad include | |
| Minimal `SKILL.md` only | Thin include | |

### Q2: Skill load timing
| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory pre-stage load | Before planning/generation/preview/write; fail closed | ✓ |
| Load once on activation | Assume persistent validity | |
| Load only at generation | Partial pre-stage loading | |

### Q3: Skill quality checks
| Option | Description | Selected |
|--------|-------------|----------|
| Full gate | Schema/frontmatter + link integrity + hygiene + manifest hash | ✓ |
| Link integrity only | Partial validation | |
| Presence only | Existence check only | |

### Q4: Behavior on quality-gate failure
| Option | Description | Selected |
|--------|-------------|----------|
| Block stage + require user decision | No degraded silent fallback | ✓ |
| Warn and continue | Degraded operation allowed | |
| Silent auto-repair and continue | Hidden mutation path | |

**User's choice:** Skills folder is mandatory governance input with strict bundling and blocking quality gate.
**Notes:** User explicitly requested skill loading before planning/test generation/write flow.

---

## the agent's Discretion

- Manifest structure/hash implementation details for skill-bundle integrity checks.
- Final copy/layout details for preview and escalation message surfaces.

## Deferred Ideas

None.
