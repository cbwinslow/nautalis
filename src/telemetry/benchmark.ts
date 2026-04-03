import { createSpan, recordMetric, logMessage } from './api.js';
import { SPAN_NAMES, METRIC_NAMES } from '../types/telemetry.js';

interface BenchmarkResult {
  durationMs: number;
  success: boolean;
  error?: string;
  attributes: Record<string, string | number | boolean>;
}

interface BenchmarkOptions {
  spanName: string;
  metricName?: string;
  attributes?: Record<string, string | number | boolean>;
  logResult?: boolean;
}

export async function benchmarkOperation<T>(
  operation: () => Promise<T>,
  options: BenchmarkOptions
): Promise<{ result: T; benchmark: BenchmarkResult }> {
  const startTime = performance.now();
  const span = createSpan(options.spanName, options.attributes);
  
  try {
    const result = await operation();
    const durationMs = performance.now() - startTime;
    
    span.end();
    
    if (options.metricName) {
      recordMetric(options.metricName, durationMs, { ...options.attributes, operation: options.spanName });
    }
    
    const benchmark: BenchmarkResult = {
      durationMs,
      success: true,
      attributes: options.attributes || {},
    };
    
    if (options.logResult) {
      logMessage('info', `Benchmark: ${options.spanName} completed in ${durationMs.toFixed(2)}ms`, {
        duration_ms: durationMs,
        ...options.attributes,
      });
    }
    
    return { result, benchmark };
  } catch (error) {
    const durationMs = performance.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    
    span.end(err);
    
    if (options.metricName) {
      recordMetric(METRIC_NAMES.CONNECTOR_ERRORS, 1, { ...options.attributes, operation: options.spanName, error: err.message });
    }
    
    const benchmark: BenchmarkResult = {
      durationMs,
      success: false,
      error: err.message,
      attributes: options.attributes || {},
    };
    
    logMessage('error', `Benchmark: ${options.spanName} failed after ${durationMs.toFixed(2)}ms: ${err.message}`, {
      duration_ms: durationMs,
      error: err.message,
      ...options.attributes,
    });
    
    throw error;
  }
}

// Convenience: benchmark for memory operations
export function benchmarkMemoryQuery(query: string, resultCount: number, durationMs: number) {
  recordMetric(METRIC_NAMES.QUERY_LATENCY, durationMs, { query_type: 'memory', result_count: resultCount });
  logMessage('info', `Memory query: "${query}" → ${resultCount} results in ${durationMs.toFixed(0)}ms`, {
    query,
    result_count: resultCount,
    duration_ms: durationMs,
  });
}

export function benchmarkMemoryStore(count: number, durationMs: number) {
  recordMetric(METRIC_NAMES.MEMORIES_STORED, count);
  logMessage('info', `Stored ${count} memories in ${durationMs.toFixed(0)}ms`, {
    count,
    duration_ms: durationMs,
  });
}
