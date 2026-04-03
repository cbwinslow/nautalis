import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { getTracer, getMeter, getLogger } from './provider.js';

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
      span.addEvent(name, attributes);
    },
  };
}

export function recordMetric(name: string, value: number, attributes?: Record<string, string | number | boolean>) {
  const meterInstance = getMeter();
  const counter = meterInstance.createCounter(name);
  counter.add(value, attributes);
}

export function logMessage(level: 'debug' | 'info' | 'warn' | 'error', message: string, attributes?: Record<string, unknown>) {
  const logger = getLogger();
  const currentSpan = trace.getSpan(context.active());
  
  logger.emit({
    severityNumber: { debug: 5, info: 9, warn: 13, error: 17 }[level],
    severityText: level,
    body: message,
    attributes: {
      ...attributes,
      ...(currentSpan ? {
        traceId: currentSpan.spanContext().traceId,
        spanId: currentSpan.spanContext().spanId,
      } : {}),
    },
  });
}
