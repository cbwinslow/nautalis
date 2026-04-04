// @ts-nocheck - Telemetry stub to allow compilation; full OTel implementation pending

// No-op initialization
export function initTelemetry(serviceName = 'nautalis', version = '0.1.0'): void {
  console.log(
    `[nautalis] Telemetry initialized (stub) — endpoint: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'none'}`,
  );
}

export async function shutdownTelemetry(): Promise<void> {
  // Stub
}

// Dummy tracer provider
const dummyTracer = {
  startSpan: (name: string, options?: any) => {
    const span = {
      name,
      end: (error?: Error) => {},
      addEvent: (name: string, attributes?: any, timestamp?: any) => {},
      setAttribute: (key: string, value: any) => {},
      recordException: (error?: Error, attributes?: any) => {},
      setStatus: (status: any) => {},
      spanContext: () => ({
        traceId: '00000000000000000000000000000000',
        spanId: '0000000000000000',
      }),
    };
    return span;
  },
};

export function getTracer(name = 'nautalis') {
  return dummyTracer;
}

export function getMeter(name = 'nautalis') {
  return {
    createCounter: (name?: string) => ({
      add: (value: number, attributes?: any) => {},
    }),
    createHistogram: (name?: string) => ({
      record: (value: number, attributes?: any) => {},
    }),
    createGauge: (name?: string) => ({
      record: (value: number, attributes?: any) => {},
    }),
  };
}

export function getLogger(name = 'nautalis') {
  return {
    emit: (logRecord: any) => {},
  };
}
