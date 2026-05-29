# Pitfalls Research

**Domain:** VS Code Copilot Playwright orchestration extension
**Researched:** 2026-05-29
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Pattern mis-detection in repo analysis

**What goes wrong:** generated tests ignore established POM/Screenplay conventions.

**Why it happens:** shallow file sampling and weak heuristics.

**How to avoid:** multi-signal detection (imports, class shapes, naming, folder conventions) + confidence score + human override.

**Warning signs:** generated imports point to non-existing abstractions; duplicated helper logic appears.

**Phase to address:** Phase 1 (foundation + analyzer).

---

### Pitfall 2: Jira relationship traversal gaps

**What goes wrong:** missing parent/subtask/epic/linked context creates partial requirements.

**Why it happens:** fetch only target issue without graph expansion.

**How to avoid:** explicit traversal policy and deduped graph walk with cycle protection.

**Warning signs:** plan references unknown dependencies; acceptance criteria coverage looks sparse.

**Phase to address:** Phase 2 (context ingestion).

---

### Pitfall 3: Confluence noise polluting plan

**What goes wrong:** unrelated pages degrade planning quality.

**Why it happens:** broad CQL query and no relevance threshold.

**How to avoid:** relevance scoring + neutral treatment of low-relevance results.

**Warning signs:** plan includes non-ticket domain language or outdated constraints.

**Phase to address:** Phase 2.

---

### Pitfall 4: Gate bypass under UX pressure

**What goes wrong:** tests are generated/written before explicit approval.

**Why it happens:** async state bugs or optimistic default actions.

**How to avoid:** blocking state machine with explicit “approved” transitions only.

**Warning signs:** file write events without approval event in logs.

**Phase to address:** Phase 3/4 (planning + generation).

---

### Pitfall 5: Unsafe file writes

**What goes wrong:** existing test suites get overwritten or imports broken.

**Why it happens:** full-file rewrite strategy or naive string replacement.

**How to avoid:** append/surgical patch strategy with diff preview + backup points.

**Warning signs:** unrelated hunks changed in preview; deleted existing test blocks.

**Phase to address:** Phase 4/5 (generation + write).

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single monolithic orchestrator file | Fast start | Hard to extend/debug | Never past prototype |
| Implicit JSON contracts between stages | Less typing | brittle runtime failures | Never in v1 |
| Unlimited retry loops | “looks smart” | runaway operations + hidden churn | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Jira attachments | fetch metadata only, ignore content links | include attachment metadata + controlled retrieval hooks |
| Confluence CQL | over-broad query without project/ticket anchors | derive scoped CQL from issue keys + domain terms |
| Playwright run | execute whole test suite instead of generated set | run scoped file list first, then optional broader pass |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential deep fetch | long wait on large epics | bounded parallel traversal + caching | 20+ linked issues |
| Huge unchunked prompts | token overflow, low quality | stage-wise summarization and strict schemas | large attachments/wiki data |
| UI rendering all scenarios flat | slow, unreadable review | grouped tabs + lazy rendering | 50+ scenarios |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Prompting raw API tokens | credential leakage | env-only local tools, redaction middleware |
| Logging unredacted secrets | audit log breach | structured logger with secret scrubber |
| Passing attachment binaries into model by default | data overexposure | metadata-first, opt-in content extraction |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Too many approval clicks without grouping | fatigue, accidental approves | bulk actions + group-level review |
| Gate states unclear in chat | confusion/stalls | explicit gate banners + quick actions |
| Freeform comments not looped back | trust loss | comments trigger regeneration + re-approval |

## "Looks Done But Isn't" Checklist

- [ ] Repo analyzer detects pattern with confidence + override path
- [ ] Confidence engine produces explainable component scores
- [ ] Rejected scenarios never enter generation list
- [ ] Preview gate blocks all write operations until approved
- [ ] AI interaction logs include stage, decision, prompt hash, redaction status

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong scenario generation | MEDIUM | reject scenario -> regenerate plan subset -> re-approve |
| Broken writes | HIGH | restore file from git + apply surgical patch path |
| Low-confidence dead-end | LOW | request missing context or manual user constraints |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Pattern mis-detection | Phase 1 | analyzer validation tests on sample repos |
| Context traversal gaps | Phase 2 | fixture tickets with parent/epic/subtask/links |
| Gate bypass | Phase 3/4 | state-machine tests for illegal transitions |
| Unsafe write | Phase 4/5 | golden diff tests on existing spec files |

## Sources

- https://code.visualstudio.com/api/extension-guides/chat
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
- https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-search/
- https://playwright.dev/docs/best-practices

---
*Pitfalls research for: VS Code Copilot Playwright orchestration extension*
*Researched: 2026-05-29*
