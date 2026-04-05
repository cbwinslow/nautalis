import { test, expect, beforeEach } from "bun:test";
import * as provider from "../../src/telemetry/provider.js";

test("initTelemetry does not throw", () => {
  provider.initTelemetry();
});

test("shutdownTelemetry resolves", async () => {
  await provider.shutdownTelemetry();
});

test("getTracer returns tracer with startSpan", () => {
  const tracer = provider.getTracer();
  expect(typeof tracer.startSpan).toBe("function");
  const span = tracer.startSpan("op");
  expect(span).toBeDefined();
  expect(typeof span.end).toBe("function");
  span.end();
});

test("getMeter returns meter with metric creators", () => {
  const meter = provider.getMeter();
  expect(typeof meter.createCounter).toBe("function");
  expect(typeof meter.createHistogram).toBe("function");
  expect(typeof meter.createGauge).toBe("function");
  meter.createCounter("c").add(1);
  meter.createHistogram("h").record(2);
  meter.createGauge("g").record(3);
});

test("getLogger returns logger with emit", () => {
  const logger = provider.getLogger();
  expect(typeof logger.emit).toBe("function");
  logger.emit({ body: "msg", severityText: "INFO" });
});

test("createSpan wrapper works", () => {
  const span = provider.createSpan("wrapped");
  expect(span).toBeDefined();
  span.end();
});

test("recordMetric stub does not throw", () => {
  provider.recordMetric("m", 10);
});

test("logMessage calls console without throwing", () => {
  provider.logMessage("info", "Hello");
  provider.logMessage("debug", "Debug");
  provider.logMessage("warn", "Warn");
  provider.logMessage("error", "Error");
});
