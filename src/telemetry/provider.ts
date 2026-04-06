// @ts-nocheck - Temporarily disable type checking for OTel due to version mismatches
import { trace, metrics } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

import { loadConfig } from '../config/loader.js';
import { logMessage } from './api.js';

let _tracer: any = null;
let _meter: any = null;
let _logger: any = null;
let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry based on configuration.
 * - Reads config.observability.enabled (default true)
 * - Uses OTEL_EXPORTER_OTLP_ENDPOINT or config.observability.otlpEndpoint
 * - Sets service name/version from package.json (passed as args)
 */
export async function initTelemetry(serviceName = 'nautalis', version = '0.1.0'): Promise<void> {
  const config = await loadConfig();

  const obs = config.observability || {};
  const enabled = obs.enabled !== false;
  if (!enabled) {
    logMessage('info', 'Observability disabled by configuration');
    return;
  }

  const endpoint = obs.otlpEndpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT_URL;
  if (!endpoint) {
    logMessage('warn', 'OTEL_EXPORTER_OTLP_ENDPOINT not set; observability disabled');
    return;
  }

  try {
    // Build Resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: version,
      ...(config.deployment && { 'deployment.environment': config.deployment }),
    });

    // Trace
    const traceExporter = new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    });
    const spanProcessor = new BatchSpanProcessor({ exporter: traceExporter });

    // Metrics
    const metricExporter = new OTLPMetricExporter({
      url: `${endpoint}/v1/metrics`,
    });
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 60000,
    });

    // SDK (trace + metrics only; logs not yet integrated)
    sdk = new NodeSDK({
      resource,
      spanProcessor,
      metricReader,
      // No logExporter for now
    });

    await sdk.start();

    // Get global instruments
    _tracer = trace.getTracer(serviceName);
    _meter = metrics.getMeter(serviceName);
    // OTel logs not configured; _logger stays null; fallback to console

    logMessage('info', `Observability initialized — OTLP endpoint: ${endpoint}`);

    if (obs.debug || process.env.NAUTALIS_TELEMETRY_DEBUG === 'true') {
      // Enable diagnostic logging
      const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }
  } catch (error) {
    logMessage('error', 'Observability initialization failed: ' + (error as Error).message);
    sdk = null;
  }
}

/**
 * Check if telemetry is enabled (OTel SDK initialized).
 */
export function isEnabled(): boolean {
  return !!sdk;
}

/**
 * Check if telemetry is enabled (OTel SDK initialized).
 */
export function isEnabled(): boolean {
  return !!sdk;
}

/**
 * Shutdown telemetry SDK gracefully.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    _tracer = null;
    _meter = null;
    _logger = null;
    logMessage('info', 'Observability shut down');
  }
}

/**
 * Return active tracer or no-op.
 */
export function getTracer(name = 'nautalis'): any {
  if (!_tracer) {
    return {
      startSpan: (spanName: string) => ({
        name: spanName,
        traceId: '00000000000000000000000000000000',
        spanId: '0000000000000000',
        end: () => {},
        addEvent: () => {},
        setAttribute: () => {},
        recordException: () => {},
        setStatus: () => {},
        spanContext: () => ({ traceId: '00000000000000000000000000000000', spanId: '0000000000000000' }),
      }),
    };
  }
  return _tracer;
}

/**
 * Return active meter or no-op.
 */
export function getMeter(name = 'nautalis'): any {
  if (!_meter) {
    return {
      createCounter: () => ({ add: () => {} }),
      createHistogram: () => ({ record: () => {} }),
      createGauge: () => ({ record: () => {} }),
    };
  }
  return _meter;
}

/**
 * Return active logger or fallback to console.
 */
export function getLogger(name = 'nautalis'): any {
  if (!_logger) {
    return {
      emit: (logRecord: any) => {
        const level = logRecord.severityText || 'INFO';
        const msg = logRecord.body || '';
        const method = (console as any)[level.toLowerCase()];
        if (typeof method === 'function') {
          method(`[${name}] ${msg}`, logRecord.attributes || {});
        } else {
          console.log(`[${name}] ${msg}`, logRecord.attributes || {});
        }
      },
    };
  }
  return _logger;
}

// Convenience wrappers used throughout codebase
export function createSpan(name: string, attributes?: Record<string, any>) {
  const _tracer = getTracer();
  const span = _tracer.startSpan(name);
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => span.setAttribute(key, value));
  }
  return {
    span,
    end: (error?: Error) => {
      if (error) {
        span.recordException(error);
        span.setStatus({ code: 2 /* ERROR */, message: error.message });
      } else {
        span.setStatus({ code: 1 /* OK */ });
      }
      span.end();
    },
    addEvent: (eventName: string, attrs?: Record<string, unknown>) => {
      span.addEvent(eventName, attrs as any);
    },
  };
}

export function recordMetric(name: string, value: number, attributes?: Record<string, any>) {
  const _meter = getMeter();
  const counter = _meter.createCounter(name);
  counter.add(value, attributes as any);
}

export function logMessage(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  attributes?: Record<string, unknown>
) {
  const _logger = getLogger();
  const severityNumber = { debug: 5, info: 9, warn: 13, error: 17 }[level];
  _logger.emit({
    severityNumber,
    severityText: level.toUpperCase(),
    body: message,
    attributes: attributes || {},
    timestamp: new Date().toISOString(),
  });
}
