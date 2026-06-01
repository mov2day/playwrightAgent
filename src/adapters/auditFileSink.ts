import fs from 'node:fs';
import path from 'node:path';

import { listAppliedRedactionRules, redactSensitiveText } from './localToolRunner';
import type { EventSink, PipelineEvent } from './eventSink';

const DEFAULT_AUDIT_DIR = path.join('.planning', 'logs', 'audit');
const DEFAULT_RETENTION_DAYS = 14;
const DEFAULT_MAX_FILE_BYTES = 5_000_000;
const DEFAULT_SCHEMA_VERSION = 'pipeline_event.v1';

interface RedactionEvidenceBuilder {
  fieldCount: number;
  appliedRules: Set<string>;
}

export interface PersistedAuditRecord extends PipelineEvent {
  schemaVersion: string;
  persistedAt: string;
  redactionEvidence: {
    redacted: true;
    fieldCount: number;
    appliedRules: string[];
  };
}

export interface AuditFileSinkOptions {
  rootDir?: string;
  auditDir?: string;
  retentionDays?: number;
  maxFileBytes?: number;
  now?: () => Date;
  onPersistError?: (error: Error, event: PipelineEvent) => void;
}

function ensureParentDirectory(absolutePath: string): void {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
}

function sanitizeRequestId(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return 'unknown-request';
  }
  return normalized.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function redactSerializedValue(value: string, evidence: RedactionEvidenceBuilder): string {
  const next = redactSensitiveText(value);
  if (next === value) {
    return value;
  }

  evidence.fieldCount += 1;
  for (const ruleId of listAppliedRedactionRules(value)) {
    evidence.appliedRules.add(ruleId);
  }

  return next;
}

function redactSerializable(value: unknown, evidence: RedactionEvidenceBuilder): unknown {
  if (typeof value === 'string') {
    return redactSerializedValue(value, evidence);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSerializable(item, evidence));
  }

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      next[key] = redactSerializable(nestedValue, evidence);
    }
    return next;
  }

  return value;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export class AuditFileSink implements EventSink {
  private readonly rootDir: string;

  private readonly auditDir: string;

  private readonly retentionDays: number;

  private readonly maxFileBytes: number;

  private readonly now: () => Date;

  private readonly onPersistError?: (error: Error, event: PipelineEvent) => void;

  constructor(options: AuditFileSinkOptions = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.auditDir = options.auditDir ?? DEFAULT_AUDIT_DIR;
    this.retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.now = options.now ?? (() => new Date());
    this.onPersistError = options.onPersistError;
  }

  emit(event: PipelineEvent): void {
    try {
      const record = this.toPersistedRecord(event);
      const auditFilePath = this.resolveAuditFilePath(event.requestId);
      const line = `${JSON.stringify(record)}\n`;
      ensureParentDirectory(auditFilePath);
      this.rotateAuditFile(auditFilePath, byteLength(line));
      fs.appendFileSync(auditFilePath, line, 'utf8');
      this.pruneExpiredFiles(path.dirname(auditFilePath));
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Unknown audit persistence error');
      this.onPersistError?.(normalized, event);
    }
  }

  private toPersistedRecord(event: PipelineEvent): PersistedAuditRecord {
    const evidence: RedactionEvidenceBuilder = {
      fieldCount: 0,
      appliedRules: new Set<string>()
    };

    const redacted = redactSerializable(event, evidence) as PipelineEvent;
    return {
      ...redacted,
      schemaVersion: redacted.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
      persistedAt: this.now().toISOString(),
      redactionEvidence: {
        redacted: true,
        fieldCount: evidence.fieldCount,
        appliedRules: [...evidence.appliedRules].sort((left, right) => left.localeCompare(right))
      }
    };
  }

  private resolveAuditFilePath(requestId: string): string {
    const relativePath = path.join(this.auditDir, `${sanitizeRequestId(requestId)}.ndjson`);
    return path.resolve(this.rootDir, relativePath);
  }

  private rotateAuditFile(auditFilePath: string, incomingBytes: number): void {
    if (!fs.existsSync(auditFilePath)) {
      return;
    }

    const currentSize = fs.statSync(auditFilePath).size;
    if ((currentSize + incomingBytes) <= this.maxFileBytes) {
      return;
    }

    const stamp = this.now().toISOString().replace(/[:.]/g, '-');
    const parsed = path.parse(auditFilePath);
    let suffix = 0;
    let rotatedPath = path.join(parsed.dir, `${parsed.name}.${stamp}.ndjson`);
    while (fs.existsSync(rotatedPath)) {
      suffix += 1;
      rotatedPath = path.join(parsed.dir, `${parsed.name}.${stamp}.${suffix}.ndjson`);
    }

    fs.renameSync(auditFilePath, rotatedPath);
  }

  private pruneExpiredFiles(auditDirectoryPath: string): void {
    if (this.retentionDays <= 0 || !fs.existsSync(auditDirectoryPath)) {
      return;
    }

    const cutoff = this.now().getTime() - (this.retentionDays * 24 * 60 * 60 * 1000);
    for (const entry of fs.readdirSync(auditDirectoryPath)) {
      if (!entry.endsWith('.ndjson')) {
        continue;
      }

      const absolutePath = path.join(auditDirectoryPath, entry);
      const stats = fs.statSync(absolutePath);
      if (stats.mtimeMs < cutoff) {
        fs.unlinkSync(absolutePath);
      }
    }
  }
}
