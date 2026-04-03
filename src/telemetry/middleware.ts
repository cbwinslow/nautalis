import { createSpan, recordMetric, logMessage } from './api.js';
import { SPAN_NAMES, METRIC_NAMES } from '../types/telemetry.js';
import type { NautalisEvent } from '../types/event.js';

export function telemetryMiddleware<T extends (...args: any[]) => Promise<any>>(
  spanName: string,
  fn: T,
  attributes?: Record<string, string | number | boolean>
): T {
  return (async (...args: any[]) => {
    const startTime = performance.now();
    const span = createSpan(spanName, {
      ...attributes,
      'operation.name': fn.name || 'anonymous',
    });
    
    try {
      const result = await fn(...args);
      const durationMs = performance.now() - startTime;
      
      span.end();
      recordMetric(METRIC_NAMES.QUERY_LATENCY, durationMs, { operation: spanName });
      
      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      
      span.end(err);
      recordMetric(METRIC_NAMES.CONNECTOR_ERRORS, 1, { operation: spanName, error: err.message });
      
      logMessage('error', `${spanName} failed: ${err.message}`, {
        error: err.message,
        duration_ms: durationMs,
      });
      
      throw error;
    }
  }) as T;
}

// Event ingestion telemetry wrapper
export function withIngestTelemetry(event: NautalisEvent) {
  return createSpan(SPAN_NAMES.INGEST_EVENT, {
    'event.type': event.type,
    'event.tool': event.toolName || 'unknown',
    'event.source': event.source.toolName,
    'event.session': event.source.sessionId,
    'project.id': event.project.projectId,
    'files.count': event.filesInvolved.length,
  });
}
