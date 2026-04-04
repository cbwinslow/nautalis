// @ts-nocheck - Telemetry API; provider is stub, types not enforced
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { getTracer, getMeter, getLogger } from './provider.js';

/**
 * Create a telemetry span.
 */
export function createSpan(name: string, attributes?: Record<string, string | number | boolean>) {
  const tracer = getTracer();
  const span = tracer.startSpan(name, { kind: SpanKind.INTERNAL });

  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }

  return {
    span,
    end: (error?: Error) => {
      if (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      span.end();
    },
    addEvent: (name: string, attributes?: Record<string, unknown>) => {
      span.addEvent(name, attributes as any);
    },
  };
}

/**
 * Record a metric.
 */
export function recordMetric(
  name: string,
  value: number,
  attributes?: Record<string, string | number | boolean>,
) {
  const meterInstance = getMeter();
  const counter = meterInstance.createCounter(name);
  counter.add(value, attributes as any);
}

/**
 * Log a structured message.
 */
export function logMessage(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  attributes?: Record<string, unknown>,
) {
  const logger = getLogger();
  const currentSpan = trace.getSpan(context.active());

  logger.emit({
    severityNumber: { debug: 5, info: 9, warn: 13, error: 17 }[level],
    severityText: level,
    body: message,
    attributes: {
      ...attributes,
      ...(currentSpan
        ? {
            traceId: currentSpan.spanContext().traceId,
            spanId: currentSpan.spanContext().spanId,
          }
        : {}),
    },
  });
}

/**
 * Benchmark an async operation with telemetry.
 */
export async function benchmarkOperation<T>(
  fn: () => Promise<T>,
  options: {
    spanName: string;
    metricName?: string;
    attributes?: Record<string, string | number | boolean>;
    logResult?: boolean;
  },
): Promise<{ result: T; durationMs: number; success: boolean }> {
  const { spanName, metricName, attributes = {}, logResult = false } = options;

  const span = createSpan(spanName, attributes);
  const startTime = Date.now();

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    if (metricName) {
      recordMetric(metricName, durationMs, attributes);
    }

    span.end();

    if (logResult) {
      logMessage('info', `Benchmark success: ${spanName} completed in ${durationMs}ms`, {
        durationMs,
        ...attributes,
      });
    }

    return { result, durationMs, success: true };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (metricName) {
      recordMetric(`${metricName}.errors`, 1, attributes);
    }

    span.end(error as Error);

    logMessage('error', `Benchmark failed: ${spanName} error after ${durationMs}ms: ${error}`, {
      durationMs,
      error: String(error),
      ...attributes,
    });

    throw error;
  }
}
