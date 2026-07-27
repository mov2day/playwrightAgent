import { useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';

import type { QuickAction } from '../participant/actions';
import type { ReviewActionEnvelope } from './reviewActions';
import type { ReviewCommentEntry, ReviewGroupView, ReviewScenarioView, ReviewTabId, ReviewViewModel } from './reviewModel';
import type { PreviewViewModel } from './previewModel';

export const REVIEW_THEME_COLORS = {
  dominant: '#08111f',
  secondary: '#0f1b2d',
  accent: '#38bdf8',
  accentSoft: '#d7f1fb',
  destructive: '#ef4444',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  outline: 'rgba(148, 163, 184, 0.18)'
} as const;

export interface ReviewAppProps {
  model: ReviewViewModel;
  dispatch?: (action: ReviewActionEnvelope) => void;
}

function stateChipColor(state: ReviewScenarioView['approvalState']): 'default' | 'success' | 'error' | 'warning' {
  if (state === 'approved') {
    return 'success';
  }

  if (state === 'rejected') {
    return 'error';
  }

  if (state === 'needs_revision') {
    return 'warning';
  }

  return 'default';
}

function resolveScenarioIds(tab: ReviewTabId, model: ReviewViewModel): string[] {
  if (tab === 'all') {
    return model.orderedScenarioIds;
  }

  if (tab === 'rejected') {
    const rejectedGroup = model.tabs.find((item) => item.tabId === 'rejected')?.groups[0];
    return rejectedGroup?.scenarioIds ?? [];
  }

  const groups = model.tabs.find((item) => item.tabId === tab)?.groups ?? [];
  const groupedScenarioIds = groups.flatMap((group) => group.scenarioIds);
  return [...new Set(groupedScenarioIds)];
}

function renderGroups(groups: ReviewGroupView[]): string {
  return groups.map((group) => `${group.label} (${group.count})`).join(' | ');
}

function renderCommentSummary(comments: readonly ReviewCommentEntry[]): string {
  if (comments.length === 0) {
    return 'No reviewer notes yet.';
  }

  return comments
    .slice(0, 2)
    .map((comment) => `${comment.classification}: ${comment.text || 'pending note'}`)
    .join(' • ');
}

function getTabCount(model: ReviewViewModel, tabId: ReviewTabId): number {
  return model.tabs.find((tab) => tab.tabId === tabId)?.count ?? 0;
}

function stateLabel(state: ReviewViewModel['state']): string {
  return state.replaceAll('_', ' ');
}

function resolveSessionActionLabel(action: QuickAction): string {
  if (action === 'approve') {
    return 'Approve Plan';
  }
  if (action === 'reject') {
    return 'Reject Plan';
  }
  if (action === 'continue') {
    return 'Continue Flow';
  }
  return 'Cancel Run';
}

function resolveSessionActionVariant(action: QuickAction): 'contained' | 'outlined' | 'text' {
  if (action === 'approve' || action === 'continue') {
    return 'contained';
  }
  if (action === 'reject') {
    return 'outlined';
  }
  return 'text';
}

export function ReviewApp({ model, dispatch }: ReviewAppProps) {
  const [activeTab, setActiveTab] = useState<ReviewTabId>(model.activeTabId);

  const visibleScenarioIds = useMemo(
    () => resolveScenarioIds(activeTab, model),
    [activeTab, model]
  );

  const scenarios = visibleScenarioIds
    .map((scenarioId) => model.scenariosById[scenarioId])
    .filter((scenario): scenario is ReviewScenarioView => Boolean(scenario));

  const activeGroups = model.tabs.find((tab) => tab.tabId === activeTab)?.groups ?? [];

  const dispatchAction = (action: ReviewActionEnvelope): void => {
    dispatch?.(action);
  };

  const requirementCount = getTabCount(model, 'by_requirement');
  const acceptanceCriteriaCount = getTabCount(model, 'by_acceptance_criteria');
  const functionalityCount = getTabCount(model, 'by_functionality');
  const groupedSummary = `requirements (${requirementCount}), acceptance criteria (${acceptanceCriteriaCount}), functionalities (${functionalityCount})`;
  const awaitingSummary = model.availableActions.length > 0
    ? model.availableActions.join(', ')
    : 'none';

  return (
    <Box
      sx={{
        background: 'radial-gradient(circle at top, rgba(56, 189, 248, 0.16), transparent 28%), linear-gradient(180deg, #08111f 0%, #0b1424 45%, #0e1728 100%)',
        minHeight: '100vh',
        color: REVIEW_THEME_COLORS.textPrimary,
        p: { xs: 2, md: 3 },
        pb: 16,
        fontFamily: '"Aptos", "Segoe UI Variable Text", "Segoe UI", sans-serif'
      }}
    >
      <Stack spacing={3}>
        <Box
          sx={{
            border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
            bgcolor: 'rgba(8, 17, 31, 0.82)',
            borderRadius: '28px',
            p: { xs: 2.5, md: 3.5 },
            boxShadow: '0 32px 80px rgba(2, 6, 23, 0.45)'
          }}
        >
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
              <Stack spacing={1.25} sx={{ maxWidth: 760 }}>
                <Chip
                  label="Plan Review Gate"
                  sx={{
                    alignSelf: 'flex-start',
                    bgcolor: 'rgba(56, 189, 248, 0.12)',
                    color: REVIEW_THEME_COLORS.accent,
                    borderRadius: '999px',
                    border: '1px solid rgba(56, 189, 248, 0.22)',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase'
                  }}
                />
                <Typography variant="h3" sx={{ fontSize: { xs: 30, md: 42 }, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.02 }}>
                  Review scenarios before generation.
                </Typography>
                <Typography variant="body1" sx={{ color: REVIEW_THEME_COLORS.textSecondary, maxWidth: 680, lineHeight: 1.7 }}>
                  Grouped views: {groupedSummary}. This panel mirrors the live pipeline state and only shows actions the orchestrator can actually honor.
                </Typography>
              </Stack>
              <Stack spacing={1.25} sx={{ minWidth: { md: 260 } }}>
                <Box
                  sx={{
                    borderRadius: '24px',
                    border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
                    bgcolor: 'rgba(15, 27, 45, 0.88)',
                    p: 2
                  }}
                >
                  <Typography variant="overline" sx={{ color: REVIEW_THEME_COLORS.textSecondary, letterSpacing: '0.12em' }}>
                    Request
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                    {model.requestId}
                  </Typography>
                  <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textSecondary, mt: 1 }}>
                    State: {stateLabel(model.state)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textSecondary, mt: 0.5 }}>
                    Awaiting action: {awaitingSummary}
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              {[
                { label: 'Requirements', value: requirementCount, tone: 'rgba(56, 189, 248, 0.12)' },
                { label: 'Acceptance Criteria', value: acceptanceCriteriaCount, tone: 'rgba(34, 197, 94, 0.12)' },
                { label: 'Functionalities', value: functionalityCount, tone: 'rgba(245, 158, 11, 0.12)' }
              ].map((stat) => (
                <Box
                  key={stat.label}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: '22px',
                    border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
                    bgcolor: stat.tone,
                    p: 2
                  }}
                >
                  <Typography variant="overline" sx={{ color: REVIEW_THEME_COLORS.textSecondary, letterSpacing: '0.12em' }}>
                    {stat.label}
                  </Typography>
                  <Typography variant="h4" sx={{ fontSize: 30, fontWeight: 700, mt: 0.5 }}>
                    {stat.value}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Box>

        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: 'rgba(15, 27, 45, 0.92)',
            borderRadius: '24px',
            border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
            color: REVIEW_THEME_COLORS.textPrimary,
            overflow: 'hidden'
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, value: ReviewTabId) => setActiveTab(value)}
            textColor="inherit"
            variant="scrollable"
            allowScrollButtonsMobile
            TabIndicatorProps={{
              style: {
                backgroundColor: REVIEW_THEME_COLORS.accent,
                height: 3
              }
            }}
          >
            {model.tabs.map((tab) => (
              <Tab
                key={tab.tabId}
                value={tab.tabId}
                label={`${tab.label} (${tab.count})`}
                data-tab={tab.tabId}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  minHeight: 68,
                  color: REVIEW_THEME_COLORS.textSecondary
                }}
              />
            ))}
          </Tabs>
        </AppBar>

        <Box
          sx={{
            border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
            bgcolor: 'rgba(15, 27, 45, 0.82)',
            borderRadius: '24px',
            px: 2.25,
            py: 1.75
          }}
        >
          <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textSecondary }}>
            Active groups: {renderGroups(activeGroups)}
          </Typography>
        </Box>

        {scenarios.length === 0 ? (
          <Card
            sx={{
              bgcolor: 'rgba(15, 27, 45, 0.88)',
              border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
              borderRadius: '24px',
              color: REVIEW_THEME_COLORS.textPrimary
            }}
          >
            <CardContent>
              <Typography variant="h6">No scenarios in this view</Typography>
              <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textSecondary }}>
                Try another group tab or add revision feedback to regenerate targeted scenarios.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {scenarios.map((scenario) => (
              <Card
                key={scenario.scenarioId}
                sx={{
                  bgcolor: 'rgba(15, 27, 45, 0.88)',
                  border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
                  borderRadius: '26px',
                  color: REVIEW_THEME_COLORS.textPrimary,
                  boxShadow: '0 18px 48px rgba(2, 6, 23, 0.28)'
                }}
              >
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip
                            label={scenario.primaryRequirementId}
                            sx={{ bgcolor: 'rgba(56, 189, 248, 0.12)', color: REVIEW_THEME_COLORS.accentSoft, fontWeight: 700 }}
                          />
                          <Chip
                            label={scenario.functionality}
                            sx={{ bgcolor: 'rgba(34, 197, 94, 0.12)', color: '#bbf7d0', fontWeight: 700 }}
                          />
                          <Chip
                            label={scenario.riskLevel.toUpperCase()}
                            sx={{
                              bgcolor: scenario.riskLevel === 'high'
                                ? 'rgba(239, 68, 68, 0.14)'
                                : scenario.riskLevel === 'medium'
                                  ? 'rgba(245, 158, 11, 0.14)'
                                  : 'rgba(34, 197, 94, 0.14)',
                              color: scenario.riskLevel === 'high'
                                ? '#fecaca'
                                : scenario.riskLevel === 'medium'
                                  ? '#fde68a'
                                  : '#bbf7d0',
                              fontWeight: 700
                            }}
                          />
                        </Stack>
                        <Typography variant="h5" sx={{ fontSize: { xs: 22, md: 24 }, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                          {scenario.scenarioName}
                        </Typography>
                      </Stack>
                      <Chip
                        label={scenario.approvalState.replaceAll('_', ' ')}
                        color={stateChipColor(scenario.approvalState)}
                        sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, fontWeight: 700 }}
                      />
                    </Stack>

                    <Stack spacing={1}>
                      <Typography variant="body1" sx={{ color: REVIEW_THEME_COLORS.textSecondary, lineHeight: 1.75 }}>
                        {scenario.scope}
                      </Typography>
                      <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textSecondary, lineHeight: 1.75 }}>
                        <strong style={{ color: REVIEW_THEME_COLORS.textPrimary }}>Assertion intent:</strong> {scenario.assertionIntentSummary}
                      </Typography>
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                      <Box
                        sx={{
                          flex: 1,
                          borderRadius: '20px',
                          border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
                          bgcolor: 'rgba(8, 17, 31, 0.38)',
                          p: 1.75
                        }}
                      >
                        <Typography variant="overline" sx={{ color: REVIEW_THEME_COLORS.textSecondary, letterSpacing: '0.12em' }}>
                          Risk
                        </Typography>
                        <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textPrimary, mt: 0.75, lineHeight: 1.7 }}>
                          {scenario.riskReason}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          flex: 1,
                          borderRadius: '20px',
                          border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
                          bgcolor: 'rgba(8, 17, 31, 0.38)',
                          p: 1.75
                        }}
                      >
                        <Typography variant="overline" sx={{ color: REVIEW_THEME_COLORS.textSecondary, letterSpacing: '0.12em' }}>
                          Coverage
                        </Typography>
                        <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textPrimary, mt: 0.75, lineHeight: 1.7 }}>
                          Acceptance criteria: {scenario.acceptanceCriteriaIds.join(', ') || '-'}
                        </Typography>
                      </Box>
                    </Stack>

                    {scenario.revisionReason.length > 0 ? (
                      <Box
                        sx={{
                          borderRadius: '20px',
                          border: '1px solid rgba(245, 158, 11, 0.24)',
                          bgcolor: 'rgba(245, 158, 11, 0.08)',
                          p: 1.75
                        }}
                      >
                        <Typography variant="overline" sx={{ color: '#fde68a', letterSpacing: '0.12em' }}>
                          Revision Reasons
                        </Typography>
                        <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textPrimary, mt: 0.75 }}>
                          {scenario.revisionReason.join(' • ')}
                        </Typography>
                      </Box>
                    ) : null}

                    <Box
                      sx={{
                        borderRadius: '20px',
                        border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
                        bgcolor: 'rgba(8, 17, 31, 0.38)',
                        p: 1.75
                      }}
                    >
                      <Typography variant="overline" sx={{ color: REVIEW_THEME_COLORS.textSecondary, letterSpacing: '0.12em' }}>
                        Reviewer Notes
                      </Typography>
                      <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textPrimary, mt: 0.75, lineHeight: 1.7 }}>
                        {renderCommentSummary(scenario.comments)}
                      </Typography>
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        data-action="scenario.approve"
                        data-scenario-id={scenario.scenarioId}
                        variant="contained"
                        sx={{ minHeight: 46, bgcolor: REVIEW_THEME_COLORS.accent, color: '#082f49', fontWeight: 700, borderRadius: '999px' }}
                        onClick={() => dispatchAction({
                          type: 'scenario.approve',
                          requestId: model.requestId,
                          source: 'webview',
                          optimisticVersion: Date.now(),
                          scenarioId: scenario.scenarioId
                        })}
                      >
                        Approve Scenario
                      </Button>
                      <Button
                        data-action="scenario.reject"
                        data-scenario-id={scenario.scenarioId}
                        data-reason="Move this scenario to Needs Revision?"
                        variant="outlined"
                        color="error"
                        sx={{ minHeight: 46, borderRadius: '999px', borderColor: 'rgba(239, 68, 68, 0.42)', color: '#fecaca' }}
                        onClick={() => dispatchAction({
                          type: 'scenario.reject',
                          requestId: model.requestId,
                          source: 'webview',
                          optimisticVersion: Date.now(),
                          scenarioId: scenario.scenarioId,
                          reason: 'Move this scenario to Needs Revision?'
                        })}
                      >
                        Send To Revision
                      </Button>
                      <Button
                        data-action="scenario.revise"
                        data-scenario-id={scenario.scenarioId}
                        data-reason="Needs additional context from reviewer"
                        variant="text"
                        sx={{ minHeight: 46, borderRadius: '999px', color: REVIEW_THEME_COLORS.textSecondary }}
                        onClick={() => dispatchAction({
                          type: 'scenario.revise',
                          requestId: model.requestId,
                          source: 'webview',
                          optimisticVersion: Date.now(),
                          scenarioId: scenario.scenarioId,
                          reason: 'Needs additional context from reviewer'
                        })}
                      >
                        Mark Needs Context
                      </Button>
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                      <TextField
                        fullWidth
                        label="Scenario note"
                        size="small"
                        multiline
                        minRows={2}
                        data-target="scenario"
                        placeholder="Add clarification, constraint, bug, or new context"
                        inputProps={{
                          'data-comment-input': 'scenario',
                          'data-scenario-id': scenario.scenarioId
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '18px',
                            bgcolor: 'rgba(8, 17, 31, 0.62)',
                            color: REVIEW_THEME_COLORS.textPrimary
                          },
                          '& .MuiInputLabel-root': {
                            color: REVIEW_THEME_COLORS.textSecondary
                          }
                        }}
                      />
                      <Button
                        data-action="comment.add"
                        data-target="scenario"
                        data-scenario-id={scenario.scenarioId}
                        variant="outlined"
                        sx={{
                          minWidth: { md: 150 },
                          minHeight: 46,
                          alignSelf: { md: 'flex-end' },
                          borderRadius: '999px',
                          borderColor: 'rgba(56, 189, 248, 0.3)',
                          color: REVIEW_THEME_COLORS.accentSoft
                        }}
                      >
                        Add Note
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        <Box
          sx={{
            border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
            bgcolor: 'rgba(15, 27, 45, 0.82)',
            borderRadius: '24px',
            p: 2.25
          }}
        >
          <Stack spacing={1.25}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Global run context
            </Typography>
            <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textSecondary }}>
              Use this for repo-wide constraints, shared selectors, environment caveats, or ticket clarifications that should influence every generated file.
            </Typography>
            {model.globalComments.length > 0 ? (
              <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textPrimary }}>
                Latest note: {renderCommentSummary(model.globalComments)}
              </Typography>
            ) : null}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
              <TextField
                fullWidth
                label="Global run comment"
                multiline
                minRows={3}
                data-target="global"
                placeholder="Global comment for this planning run"
                inputProps={{
                  'data-comment-input': 'global'
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '18px',
                    bgcolor: 'rgba(8, 17, 31, 0.62)',
                    color: REVIEW_THEME_COLORS.textPrimary
                  },
                  '& .MuiInputLabel-root': {
                    color: REVIEW_THEME_COLORS.textSecondary
                  }
                }}
              />
              <Button
                data-action="comment.add"
                data-target="global"
                variant="outlined"
                sx={{
                  minWidth: { md: 170 },
                  minHeight: 46,
                  alignSelf: { md: 'flex-end' },
                  borderRadius: '999px',
                  borderColor: 'rgba(56, 189, 248, 0.3)',
                  color: REVIEW_THEME_COLORS.accentSoft
                }}
              >
                Add Global Note
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Stack>

      <Divider sx={{ mt: 3, mb: 2, borderColor: REVIEW_THEME_COLORS.outline }} />

      <Box
        sx={{
          position: 'fixed',
          left: { xs: 12, md: 24 },
          right: { xs: 12, md: 24 },
          bottom: 16,
          bgcolor: 'rgba(8, 17, 31, 0.94)',
          border: `1px solid ${REVIEW_THEME_COLORS.outline}`,
          borderRadius: '24px',
          px: 2,
          py: 1.75,
          zIndex: 1200,
          boxShadow: '0 28px 80px rgba(2, 6, 23, 0.46)',
          backdropFilter: 'blur(14px)'
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Session controls
            </Typography>
            <Typography variant="body2" sx={{ color: REVIEW_THEME_COLORS.textSecondary }}>
              Approve or revise individual scenarios first, then use the session actions to move the pipeline forward.
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              data-action="bulk.approve"
              data-mode="pending_only"
              variant="contained"
              sx={{ minHeight: 46, bgcolor: REVIEW_THEME_COLORS.accent, color: '#082f49', fontWeight: 700, borderRadius: '999px' }}
              onClick={() => dispatchAction({
                type: 'bulk.approve',
                requestId: model.requestId,
                source: 'webview',
                optimisticVersion: Date.now(),
                mode: 'pending_only'
              })}
            >
              Approve Pending
            </Button>
            <Button
              data-action="bulk.reject"
              data-mode="pending_only"
              data-reason="Reject all pending scenarios?"
              variant="outlined"
              color="error"
              sx={{ minHeight: 46, borderRadius: '999px', borderColor: 'rgba(239, 68, 68, 0.42)', color: '#fecaca' }}
              onClick={() => dispatchAction({
                type: 'bulk.reject',
                requestId: model.requestId,
                source: 'webview',
                optimisticVersion: Date.now(),
                mode: 'pending_only',
                reason: 'Reject all pending scenarios?'
              })}
            >
              Reject Pending
            </Button>
            <Button
              data-action="bulk.force_approve"
              data-mode="force_override"
              variant="text"
              sx={{ minHeight: 46, borderRadius: '999px', color: REVIEW_THEME_COLORS.textSecondary }}
              onClick={() => dispatchAction({
                type: 'bulk.approve',
                requestId: model.requestId,
                source: 'webview',
                optimisticVersion: Date.now(),
                mode: 'force_override'
              })}
            >
              Force Approve
            </Button>
            {model.availableActions.map((action) => (
              <Button
                key={action}
                data-action={`quick.${action}`}
                color={action === 'reject' || action === 'cancel' ? 'error' : 'primary'}
                variant={resolveSessionActionVariant(action)}
                sx={{
                  minHeight: 46,
                  borderRadius: '999px',
                  fontWeight: 700,
                  ...(action === 'approve' || action === 'continue'
                    ? { bgcolor: REVIEW_THEME_COLORS.accent, color: '#082f49' }
                    : {}),
                  ...(action === 'reject'
                    ? { borderColor: 'rgba(239, 68, 68, 0.42)', color: '#fecaca' }
                    : {}),
                  ...(action === 'cancel'
                    ? { color: REVIEW_THEME_COLORS.textSecondary }
                    : {})
                }}
              >
                {resolveSessionActionLabel(action)}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

export function renderReviewAppToHtml(model: ReviewViewModel): string {
  return renderToStaticMarkup(<ReviewApp model={model} />);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderPreviewPanelMarkup(previewModel: PreviewViewModel): string {
  const previewSummary = previewModel.previewSummary;
  const diffMarkup = previewModel.fileDiffs
    .map((fileDiff) => [
      '<article class="preview-file-card">',
      `  <h3>${escapeHtml(fileDiff.path)}</h3>`,
      `  <p data-change-type="${escapeHtml(fileDiff.changeType)}">${escapeHtml(fileDiff.changeType)} | +${fileDiff.addedLineCount} / -${fileDiff.removedLineCount}</p>`,
      `  <pre data-field="unifiedPatch">${escapeHtml(fileDiff.unifiedPatch)}</pre>`,
      '</article>'
    ].join('\n'))
    .join('\n');

  return [
    '<section class="preview-panel">',
    `  <h2 data-preview-version="${escapeHtml(previewModel.previewVersion)}">Structured summary</h2>`,
    `  <p data-summary="total">Files: ${previewSummary.totalFiles}</p>`,
    `  <p data-summary="adds">Added files: ${previewSummary.addedFiles}</p>`,
    `  <p data-summary="mods">Modified files: ${previewSummary.modifiedFiles}</p>`,
    `  <p data-summary="dels">Deleted files: ${previewSummary.deletedFiles}</p>`,
    `  <p data-summary="line-delta">Line delta: +${previewSummary.totalAddedLines} / -${previewSummary.totalRemovedLines}</p>`,
    diffMarkup,
    '</section>'
  ].join('\n');
}
