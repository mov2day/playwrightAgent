export interface PipelineEvent {
  requestId: string;
  stage: string;
  action: string;
  timestamp: string;
  confidenceProfileId?: string;
  decisionGate?: 'reject' | 'approval_required' | 'continue';
  details?: Record<string, unknown>;
}

export interface EventSink {
  emit(event: PipelineEvent): void;
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
