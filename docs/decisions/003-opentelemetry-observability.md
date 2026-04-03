# ADR 003: OpenTelemetry for Observability

**Status:** Accepted  
**Date:** 2026-01-15  
**Context:** Observability framework selection

## Decision

We chose **OpenTelemetry** as the observability framework for Nautalis.

## Alternatives Considered

1. **Custom logging** — Simple, but no tracing or metrics
2. **DataDog/New Relic** — Full-featured, but vendor-locked and paid
3. **Prometheus + Grafana** — Great metrics, but no tracing integration
4. **OpenTelemetry** — Open standard, vendor-neutral, full signal coverage

## Rationale

### Three Signal Coverage

OpenTelemetry provides all three observability signals:

| Signal | Purpose | Nautalis Use |
|--------|---------|--------------|
| **Traces** | Follow requests through systems | Track events from connector → memory → storage |
| **Metrics** | Aggregate system health | Memory count, query latency, connector health |
| **Logs** | Detailed diagnostic info | Structured JSON logs with correlation IDs |

### Vendor Neutrality

OpenTelemetry is a CNCF standard. We can export to any backend:

- Console (development)
- Jaeger (self-hosted tracing)
- Grafana Tempo (cloud-native tracing)
- Loki (log aggregation)
- Prometheus (metrics)
- Any OTLP-compatible collector

### Built-in Instrumentation

```typescript
// Tracing
const tracer = trace.getTracer('nautalis');
tracer.startActiveSpan('memory.store', async (span) => {
  span.setAttribute('memory.id', memory.id);
  // ... operation
  span.end();
});

// Metrics
const meter = metrics.getMeter('nautalis');
const counter = meter.createCounter('nautalis.memory.operations');
counter.add(1, { operation: 'store', agent: 'claude-code' });

// Logging
logger.info({ message: 'Memory stored', memoryId: memory.id });
```

### Benchmarking

OpenTelemetry metrics enable agent performance benchmarking:

- Track memory operations per agent
- Measure query latency percentiles
- Monitor embedding generation times
- Detect storage performance degradation

### Trade-offs Accepted

| Trade-off | Mitigation |
|-----------|-----------|
| Additional complexity | Abstracted behind telemetry module |
| Collector setup for production | Console exporter works for development |
| Learning curve | Standard patterns, well-documented |

## Consequences

- **Positive:** Full observability, vendor-neutral, enables benchmarking
- **Negative:** Requires collector setup for production use
- **Neutral:** Standard that may evolve (but CNCF-backed)
