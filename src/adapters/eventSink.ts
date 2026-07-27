import { AuditFileSink, type AuditFileSinkOptions } from './auditFileSink';

export interface PipelineEvent {
  requestId: string;
  stage: string;
  action: string;
  timestamp: string;
  schemaVersion?: string;
  interactionType?: 'ai_interaction' | 'gate_decision' | 'system_event';
  decisionAction?: 'approve' | 'reject' | 'continue' | 'cancel';
  decisionComment?: string;
  confidenceProfileId?: string;
  decisionGate?: 'reject' | 'approval_required' | 'continue';
  details?: Record<string, unknown>;
}

export interface EventSink {
  emit(event: PipelineEvent): void;
}

interface EventStreamView extends EventSink {
  getEvents?: () => readonly PipelineEvent[];
  clear?: () => void;
}

export class InMemoryEventSink implements EventSink {
  private readonly events: PipelineEvent[] = [];

  emit(event: PipelineEvent): void {
    this.events.push(event);
  }

  getEvents(): readonly PipelineEvent[] {
    return this.events;
  }

  clear(): void {
    this.events.length = 0;
  }
}

export interface CompositeEventSinkOptions {
  onSinkError?: (error: Error, sinkName: string, event: PipelineEvent) => void;
}

export class CompositeEventSink implements EventSink {
  private readonly sinks: EventStreamView[];

  private readonly onSinkError?: (error: Error, sinkName: string, event: PipelineEvent) => void;

  constructor(sinks: readonly EventSink[], options: CompositeEventSinkOptions = {}) {
    this.sinks = [...sinks];
    this.onSinkError = options.onSinkError;
  }

  emit(event: PipelineEvent): void {
    for (const sink of this.sinks) {
      try {
        sink.emit(event);
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error('Unknown event sink failure');
        this.onSinkError?.(normalized, sink.constructor?.name ?? 'EventSink', event);
      }
    }
  }

  getEvents(): readonly PipelineEvent[] {
    for (const sink of this.sinks) {
      if (typeof sink.getEvents === 'function') {
        return sink.getEvents();
      }
    }

    return [];
  }

  clear(): void {
    for (const sink of this.sinks) {
      sink.clear?.();
    }
  }
}

export type CreateDefaultEventSinkOptions = Pick<AuditFileSinkOptions, 'rootDir' | 'now' | 'retentionDays' | 'maxFileBytes'>;

export function createDefaultEventSink(options: CreateDefaultEventSinkOptions = {}): CompositeEventSink {
  const inMemorySink = new InMemoryEventSink();
  const auditFileSink = new AuditFileSink({
    rootDir: options.rootDir,
    now: options.now,
    retentionDays: options.retentionDays,
    maxFileBytes: options.maxFileBytes,
    onPersistError: (error, event) => {
      inMemorySink.emit({
        requestId: event.requestId,
        stage: 'orchestrator',
        action: 'audit_persist_error',
        timestamp: (options.now ?? (() => new Date()))().toISOString(),
        details: {
          message: error.message,
          failedAction: event.action,
          failedStage: event.stage
        }
      });
    }
  });

  return new CompositeEventSink([
    inMemorySink,
    auditFileSink
  ]);
}
