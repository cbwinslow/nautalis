export { initTelemetry, shutdownTelemetry, getTracer, getMeter, getLogger } from './provider.js';
export { createSpan, recordMetric, logMessage } from './api.js';
export { benchmarkOperation } from './benchmark.js';
export { telemetryMiddleware } from './middleware.js';
