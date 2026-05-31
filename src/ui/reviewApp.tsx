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

import type { ReviewActionEnvelope } from './reviewActions';
import type { ReviewCommentEntry, ReviewGroupView, ReviewScenarioView, ReviewTabId, ReviewViewModel } from './reviewModel';
import type { PreviewViewModel } from './previewModel';

export const REVIEW_THEME_COLORS = {
  dominant: '#F7F5EE',
  secondary: '#E6E1D2',
  accent: '#0E7490',
  destructive: '#B42318'
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

function renderCommentTargets(comments: readonly ReviewCommentEntry[]): string {
  if (comments.length === 0) {
    return 'No comments';
  }

  return comments.map((comment) => `${comment.target}:${comment.classification}`).join(', ');
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

  return (
    <Box
      sx={{
        bgcolor: REVIEW_THEME_COLORS.dominant,
        minHeight: '100vh',
        p: 3,
        pb: 12,
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15 }}>
          PlaywrightAgent Plan Review
        </Typography>
        <Typography variant="body1">Request: {model.requestId}</Typography>

        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: REVIEW_THEME_COLORS.secondary,
            borderRadius: 2,
            color: '#1f2937'
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, value: ReviewTabId) => setActiveTab(value)}
            textColor="inherit"
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
                sx={{ textTransform: 'none', fontWeight: 600 }}
              />
            ))}
          </Tabs>
        </AppBar>

        <Typography variant="body2" sx={{ color: '#4b5563' }}>
          Groups: {renderGroups(activeGroups)}
        </Typography>

        {scenarios.length === 0 ? (
          <Card sx={{ bgcolor: '#ffffff', border: `1px solid ${REVIEW_THEME_COLORS.secondary}` }}>
            <CardContent>
              <Typography variant="h6">No scenarios in this view</Typography>
              <Typography variant="body2">
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
                  bgcolor: '#ffffff',
                  border: `1px solid ${REVIEW_THEME_COLORS.secondary}`,
                  borderLeft: `4px solid ${scenario.approvalState === 'approved' ? REVIEW_THEME_COLORS.accent : REVIEW_THEME_COLORS.secondary}`
                }}
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="h6" sx={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>
                        {scenario.scenarioName}
                      </Typography>
                      <Chip label={scenario.approvalState} color={stateChipColor(scenario.approvalState)} />
                    </Stack>

                    <Typography variant="body2">Scope: {scenario.scope}</Typography>
                    <Typography variant="body2">Risk: {scenario.riskLevel.toUpperCase()} - {scenario.riskReason}</Typography>
                    <Typography variant="body2">Assertion Intent: {scenario.assertionIntentSummary}</Typography>
                    <Typography variant="body2">Requirement: {scenario.primaryRequirementId}</Typography>
                    <Typography variant="body2">Acceptance Criteria: {scenario.acceptanceCriteriaIds.join(', ') || '-'}</Typography>
                    <Typography variant="body2">Comments: {renderCommentTargets(scenario.comments)}</Typography>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        data-action="scenario.approve"
                        variant="contained"
                        sx={{ minHeight: 44, bgcolor: REVIEW_THEME_COLORS.accent }}
                        onClick={() => dispatchAction({
                          type: 'scenario.approve',
                          requestId: model.requestId,
                          source: 'webview',
                          optimisticVersion: Date.now(),
                          scenarioId: scenario.scenarioId
                        })}
                      >
                        Approve
                      </Button>
                      <Button
                        data-action="scenario.reject"
                        variant="outlined"
                        color="error"
                        sx={{ minHeight: 44, borderColor: REVIEW_THEME_COLORS.destructive, color: REVIEW_THEME_COLORS.destructive }}
                        onClick={() => dispatchAction({
                          type: 'scenario.reject',
                          requestId: model.requestId,
                          source: 'webview',
                          optimisticVersion: Date.now(),
                          scenarioId: scenario.scenarioId,
                          reason: 'Move this scenario to Needs Revision?'
                        })}
                      >
                        Reject
                      </Button>
                      <Button
                        data-action="scenario.revise"
                        variant="text"
                        sx={{ minHeight: 44 }}
                        onClick={() => dispatchAction({
                          type: 'scenario.revise',
                          requestId: model.requestId,
                          source: 'webview',
                          optimisticVersion: Date.now(),
                          scenarioId: scenario.scenarioId,
                          reason: 'Needs additional context from reviewer'
                        })}
                      >
                        Revise
                      </Button>
                    </Stack>

                    <TextField
                      label="Scenario comment"
                      size="small"
                      multiline
                      minRows={2}
                      data-target="scenario"
                      placeholder="Add clarification, constraint, bug, or new context"
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

      <Divider sx={{ mt: 3, mb: 2 }} />

      <TextField
        fullWidth
        label="Global run comment"
        multiline
        minRows={3}
        data-target="global"
        placeholder="Global comment for this planning run"
      />

      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: REVIEW_THEME_COLORS.secondary,
          borderTop: `1px solid ${REVIEW_THEME_COLORS.accent}`,
          px: 2,
          py: 1.5,
          zIndex: 1200
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Approve Selected Scenarios
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              data-action="bulk.approve"
              variant="contained"
              sx={{ minHeight: 44, bgcolor: REVIEW_THEME_COLORS.accent }}
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
              variant="outlined"
              color="error"
              sx={{ minHeight: 44, borderColor: REVIEW_THEME_COLORS.destructive, color: REVIEW_THEME_COLORS.destructive }}
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
              variant="text"
              sx={{ minHeight: 44 }}
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
            <Button
              data-action="session.continue"
              variant="text"
              sx={{ minHeight: 44 }}
              onClick={() => dispatchAction({
                type: 'session.continue',
                requestId: model.requestId,
                source: 'webview',
                optimisticVersion: Date.now()
              })}
            >
              Continue
            </Button>
            <Button
              data-action="session.cancel"
              variant="text"
              color="error"
              sx={{ minHeight: 44 }}
              onClick={() => dispatchAction({
                type: 'session.cancel',
                requestId: model.requestId,
                source: 'webview',
                optimisticVersion: Date.now()
              })}
            >
              Cancel
            </Button>
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
