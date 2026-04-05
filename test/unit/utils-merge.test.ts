import { test, expect } from "bun:test";
import { merge } from "../../src/utils/merge.js";

test("merge: shallow merge adds new properties", () => {
  const target = { a: 1, b: 2 };
  const source = { b: 3, c: 4 };
  const result = merge(target, source);
  expect(result).toEqual({ a: 1, b: 3, c: 4 });
  // target unchanged
  expect(target).toEqual({ a: 1, b: 2 });
});

test("merge: skips undefined source values", () => {
  const target = { a: 1, b: 2 };
  const source = { b: undefined, c: undefined } as any;
  const result = merge(target, source);
  expect(result).toEqual({ a: 1, b: 2 });
});

test("merge: deep merges nested objects", () => {
  const target = { a: { x: 1, y: 2 }, b: 2 };
  const source = { a: { y: 3, z: 4 } };
  const result = merge(target, source);
  expect(result).toEqual({ a: { x: 1, y: 3, z: 4 }, b: 2 });
});

test("merge: arrays are replaced, not merged", () => {
  const target = { arr: [1, 2, 3] };
  const source = { arr: [4, 5] };
  const result = merge(target, source);
  expect(result).toEqual({ arr: [4, 5] });
});

test("merge: null values are assigned", () => {
  const target = { a: 1 };
  const source = { a: null } as any;
  const result = merge(target, source);
  expect(result).toEqual({ a: null });
});

test("merge: does not mutate target", () => {
  const target = { a: { x: 1 } };
  const source = { a: { y: 2 } };
  const result = merge(target, source);
  expect(target).toEqual({ a: { x: 1 } });
  // Ensure nested objects not mutated either
  expect((target as any).a).not.toHaveProperty('y');
});

test("merge: handles empty source", () => {
  const target = { a: 1 };
  const result = merge(target, {});
  expect(result).toEqual({ a: 1 });
});

test("merge: source non-object values replace target (when source is not an object)", () => {
  const target = { a: { x: 1 } };
  const source = { a: 42 } as any;
  const result = merge(target, source);
  expect(result).toEqual({ a: 42 });
});

test("merge: deeply nested merge", () => {
  const target = { level1: { level2: { level3: { a: 1, b: 2 } } } };
  const source = { level1: { level2: { level3: { b: 3, c: 4 } } } };
  const result = merge(target, source);
  expect(result).toEqual({ level1: { level2: { level3: { a: 1, b: 3, c: 4 } } } });
});
