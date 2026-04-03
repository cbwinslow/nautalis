import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, meter, logs, context } from '@opentelemetry/api';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

let sdk: NodeSDK | null = null;
let tracerProvider: NodeTracerProvider | null = null;
let meterProvider: MeterProvider | null = null;
let loggerProvider: LoggerProvider | null = null;

export function initTelemetry(serviceName = 'nautalis', version = '0.1.0'): void {
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: version,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  });

  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

  // Trace exporter
  const traceExporter = new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` });
  tracerProvider = new NodeTracerProvider({ resource });
  tracerProvider.addSpanProcessor(new BatchSpanProcessor(traceExporter));
  tracerProvider.register();

  // Metric exporter
  const metricExporter = new OTLPMetricExporter({ url: `${otlpEndpoint}/v1/metrics` });
  meterProvider = new MeterProvider({ resource });
  meterProvider.addMetricReader(new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 5000 }));
  meterProvider.register();

  // Log exporter
  const logExporter = new OTLPLogExporter({ url: `${otlpEndpoint}/v1/logs` });
  loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
  logs.setGlobalLoggerProvider(loggerProvider);

  // Full SDK
  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({ exporter: metricExporter }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  
  console.log(`[nautalis] OpenTelemetry initialized — endpoint: ${otlpEndpoint}`);
}

export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
  await tracerProvider?.shutdown();
  await meterProvider?.shutdown();
  await loggerProvider?.shutdown();
}

export function getTracer(name = 'nautalis') {
  return trace.getTracer(name);
}

export function getMeter(name = 'nautalis') {
  return meter.getMeter(name);
}

export function getLogger(name = 'nautalis') {
  return logs.getLogger(name);
}
