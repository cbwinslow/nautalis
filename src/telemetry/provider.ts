// @ts-nocheck - Telemetry stub; full OTel integration pending

// No-op initialization
export function initTelemetry(serviceName = 'nautalis', version = '0.1.0'): void {
  console.log(`[nautalis] Telemetry initialized (stub) — service: ${serviceName} v${version}`);
}

export async function shutdownTelemetry(): Promise<void> {}

// Dummy tracer
const dummyTracer: any = {
  startSpan: (name: string, options?: any) => {
    const startTime = Date.now();
    const traceId = '0'.repeat(32);
    const spanId = '0'.repeat(16);
    return {
      name,
      traceId,
      spanId,
      end: (error?: Error) => {
        const duration = Date.now() - startTime;
        if (error) {
          console.error(`[trace] ${name} ERROR ${error.message} (${duration}ms)`);
        } else {
          console.log(`[trace] ${name} OK (${duration}ms)`);
        }
      },
      addEvent: (eventName: string, attrs?: any) => {},
      setAttribute: () => {},
      recordException: (err: Error, attrs?: any) => {},
      setStatus: () => {},
      spanContext: () => ({ traceId, spanId }),
    };
  },
};

export function getTracer(name = 'nautalis'): any {
  return dummyTracer;
}

export function getMeter(name = 'nautalis'): any {
  return {
    createCounter: () => ({ add: () => {} }),
    createHistogram: () => ({ record: () => {} }),
    createGauge: () => ({ record: () => {} }),
  };
}

export function getLogger(name = 'nautalis'): any {
  return {
    emit: (logRecord: any) => {
      const level = logRecord.severityText || 'INFO';
      const msg = logRecord.body || '';
      console[level.toLowerCase()]?.(`[${name}] ${msg}`, logRecord.attributes || {});
    },
  };
}

// Convenience wrappers
export function createSpan(name: string, attributes?: Record<string, any>) {
  return dummyTracer.startSpan(name, { attributes });
}

export function recordMetric(name: string, value: number, attributes?: Record<string, any>) {
  // stub
}

export function logMessage(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  attributes?: Record<string, unknown>
) {
  console[level](`[nautalis] ${message}`, attributes || {});
}
