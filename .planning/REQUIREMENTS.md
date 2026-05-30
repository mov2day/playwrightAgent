# Requirements: PlaywrightAgent

**Defined:** 2026-05-30
**Core Value:** Generate accurate, directly runnable Playwright tests with mandatory human approvals and zero secret exposure to the AI model.

## v1 Requirements

### Participant and Commanding

- [x] **PART-01**: QA user can invoke `@PlaywrightAgent` from Copilot Chat.
- [x] **PART-02**: QA user can run `/plan <JIRA-ID> [extra-context]` to start pipeline.
- [x] **PART-03**: QA user can run `/plan` with no ticket and provide manual context.
- [x] **PART-04**: Agent keeps request-scoped pipeline state across all gates until completion or cancel.

### Repository Analysis

- [ ] **REPO-01**: Agent analyzes repository language/framework/test layout before planning.
- [ ] **REPO-02**: Agent identifies whether project follows POM, Screenplay, or hybrid patterns.
- [ ] **REPO-03**: Agent detects reusable fixtures/helpers/page objects/tasks and reuses them during generation.
- [ ] **REPO-04**: Agent reports repo-analysis summary to user before plan approval stage.

### Jira and Confluence Context Ingestion

- [ ] **JIRA-01**: Agent fetches ticket data via local tooling only (no direct model-side API access).
- [ ] **JIRA-02**: For epic tickets, agent fetches full epic details plus linked children with full details.
- [ ] **JIRA-03**: For task tickets, agent fetches full task details, all comments, attachments, linked Jira issues, linked Confluence pages, and all sub-task full details.
- [ ] **JIRA-04**: For sub-task tickets, agent fetches full sub-task details, all comments, attachments, linked Jira issues, linked Confluence pages, and full parent task details.
- [ ] **JIRA-05**: For any ticket type, agent traverses linked Jira issues and Confluence pages from the ticket graph and includes their full details.
- [ ] **JIRA-06**: For any ticket type, agent always fetches linked epic details when an epic relationship exists.
- [ ] **CONF-01**: Agent generates Confluence queries from Jira context and fetches candidate pages via local tooling.
- [ ] **CONF-02**: Agent excludes low-relevance Confluence results from final planning context.

### Confidence Scoring and Gate Policy

- [ ] **CONF-03**: Agent computes explainable confidence score from Jira quality, repo quality, user context, and relevant Confluence context.
- [ ] **CONF-04**: Agent hard-stops and rejects pipeline when score is below 40.
- [ ] **CONF-05**: Agent requires user approval to continue when score is between 40 and 70.
- [ ] **CONF-06**: Agent continues without extra gate when score is above 70.

### Planning and Approval UX

- [ ] **PLAN-01**: Agent generates scenario plan with test names, scope, assertions, risk, and requirement/AC mappings.
- [ ] **PLAN-02**: Agent displays plan in chat with structured textual summary.
- [ ] **PLAN-03**: Agent displays plan in VS Code webview with professional tabbed grouped view.
- [ ] **PLAN-04**: User can approve/reject each scenario individually.
- [ ] **PLAN-05**: User can approve/reject all scenarios in bulk.
- [ ] **PLAN-06**: Rejected scenarios are permanently excluded from generation scope in current run.

### Generation, Preview, and Safe Writes

- [ ] **GEN-01**: Agent generates test scripts only for approved scenarios.
- [ ] **GEN-02**: Generated scripts follow detected repo pattern and reuse existing abstractions where available.
- [ ] **GEN-03**: Agent shows generated scripts in preview/diff for user approval before file writes.
- [ ] **GEN-04**: Agent writes files using append/surgical updates without deleting unrelated existing tests.
- [ ] **GEN-05**: Agent runs lint/type checks on generated output before finalizing changes.
- [ ] **GEN-06**: If first auto-fix attempt fails, agent informs user and asks how to proceed.

### Execution and Feedback Loop

- [ ] **RUN-01**: User can trigger run of newly created/updated Playwright tests from workflow.
- [ ] **RUN-02**: Agent reports pass/fail results with enough detail to distinguish likely test vs app failures.
- [ ] **RUN-03**: On failures, agent attempts one controlled fix cycle and then asks user for next action if unresolved.
- [ ] **RUN-04**: Agent supports quick chat actions (`approve`, `reject`, `continue`, `cancel`) at gate stages.
- [ ] **RUN-05**: User freeform comments can trigger regeneration and return to approval gates.

### Security and Auditability

- [ ] **SECU-01**: Jira and Confluence credentials remain in environment variables consumed by local tooling only.
- [ ] **SECU-02**: No secrets/tokens are sent to AI model prompts.
- [ ] **SECU-03**: Agent logs all AI interactions and gate decisions for audit review.
- [ ] **SECU-04**: Logs redact sensitive data before persistence.

## v2 Requirements

### Platform Expansion

- **V2PL-01**: Multi-repo orchestration support for monorepo/sub-repo test generation.
- **V2PL-02**: Framework adapters beyond Playwright.
- **V2PL-03**: Advanced autonomous remediation strategies beyond one retry cycle.
- **V2PL-04**: Team dashboard for audit and scenario analytics across runs.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Gate-less autonomous generation | Conflicts with explicit governance requirement |
| Direct cloud API calls from AI context | Violates strict secret handling policy |
| Non-Playwright framework support in v1 | Focus on Playwright execution quality first |
| Unlimited auto-fix loops | High risk of hidden churn and unsafe modifications |
| Multi-repo orchestration in v1 | Defer until single-repo stability proven |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PART-01 | Phase 1 | Complete |
| PART-02 | Phase 1 | Complete |
| PART-03 | Phase 1 | Complete |
| PART-04 | Phase 1 | Complete |
| REPO-01 | Phase 2 | Pending |
| REPO-02 | Phase 2 | Pending |
| REPO-03 | Phase 2 | Pending |
| REPO-04 | Phase 2 | Pending |
| JIRA-01 | Phase 2 | Pending |
| JIRA-02 | Phase 2 | Pending |
| JIRA-03 | Phase 2 | Pending |
| JIRA-04 | Phase 2 | Pending |
| JIRA-05 | Phase 2 | Pending |
| JIRA-06 | Phase 2 | Pending |
| CONF-01 | Phase 2 | Pending |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 2 | Pending |
| CONF-04 | Phase 2 | Pending |
| CONF-05 | Phase 2 | Pending |
| CONF-06 | Phase 2 | Pending |
| PLAN-01 | Phase 3 | Pending |
| PLAN-02 | Phase 3 | Pending |
| PLAN-03 | Phase 3 | Pending |
| PLAN-04 | Phase 3 | Pending |
| PLAN-05 | Phase 3 | Pending |
| PLAN-06 | Phase 3 | Pending |
| GEN-01 | Phase 4 | Pending |
| GEN-02 | Phase 4 | Pending |
| GEN-03 | Phase 4 | Pending |
| GEN-04 | Phase 4 | Pending |
| GEN-05 | Phase 4 | Pending |
| GEN-06 | Phase 4 | Pending |
| RUN-01 | Phase 5 | Pending |
| RUN-02 | Phase 5 | Pending |
| RUN-03 | Phase 5 | Pending |
| RUN-04 | Phase 3 | Pending |
| RUN-05 | Phase 3 | Pending |
| SECU-01 | Phase 6 | Pending |
| SECU-02 | Phase 6 | Pending |
| SECU-03 | Phase 5 | Pending |
| SECU-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-30 after initial definition*
