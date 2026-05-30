import type { JiraAttachment } from './jiraClient';

export const DEFAULT_ATTACHMENT_ALLOWLIST = ['.txt', '.md', '.json', '.csv', '.log', '.xml'] as const;

export const DEFAULT_MAX_ATTACHMENT_BYTES = 512_000;

export type AttachmentSkipReason = 'unsupported_type' | 'size_exceeded';

export interface JiraAttachmentPolicyOptions {
  allowedExtensions?: readonly string[];
  maxAttachmentBytes?: number;
}

export interface JiraAttachmentEvaluation {
  allowed: boolean;
  extension: string;
  reason?: AttachmentSkipReason;
}

export interface FilteredAttachmentsResult {
  accepted: JiraAttachment[];
  skipped: Array<{
    attachment: JiraAttachment;
    reason: AttachmentSkipReason;
  }>;
}

function normalizeExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) {
    return '';
  }
  return fileName.slice(dotIndex).toLowerCase();
}

export function isAllowlistedAttachmentExtension(
  fileName: string,
  allowlist: readonly string[] = DEFAULT_ATTACHMENT_ALLOWLIST
): boolean {
  const extension = normalizeExtension(fileName);
  return allowlist.some((value) => value.toLowerCase() === extension);
}

export function isAttachmentWithinSizeCap(
  sizeBytes: number | undefined,
  maxAttachmentBytes = DEFAULT_MAX_ATTACHMENT_BYTES
): boolean {
  if (typeof sizeBytes !== 'number') {
    return true;
  }
  return sizeBytes <= maxAttachmentBytes;
}

export function evaluateJiraAttachmentExtraction(
  attachment: JiraAttachment,
  options: JiraAttachmentPolicyOptions = {}
): JiraAttachmentEvaluation {
  const allowlist = options.allowedExtensions ?? DEFAULT_ATTACHMENT_ALLOWLIST;
  const maxAttachmentBytes = options.maxAttachmentBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES;
  const extension = normalizeExtension(attachment.fileName);

  if (!isAllowlistedAttachmentExtension(attachment.fileName, allowlist)) {
    return {
      allowed: false,
      extension,
      reason: 'unsupported_type'
    };
  }

  if (!isAttachmentWithinSizeCap(attachment.sizeBytes, maxAttachmentBytes)) {
    return {
      allowed: false,
      extension,
      reason: 'size_exceeded'
    };
  }

  return {
    allowed: true,
    extension
  };
}

export function filterAttachmentsForExtraction(
  attachments: JiraAttachment[],
  options: JiraAttachmentPolicyOptions = {}
): FilteredAttachmentsResult {
  const accepted: JiraAttachment[] = [];
  const skipped: FilteredAttachmentsResult['skipped'] = [];

  for (const attachment of attachments) {
    const evaluation = evaluateJiraAttachmentExtraction(attachment, options);
    if (evaluation.allowed) {
      accepted.push(attachment);
      continue;
    }

    skipped.push({
      attachment,
      reason: evaluation.reason ?? 'unsupported_type'
    });
  }

  return {
    accepted,
    skipped
  };
}
