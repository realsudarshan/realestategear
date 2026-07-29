import { describe, it, expect } from 'vitest';
import { str, num, int, dateOf } from '../../../src/sync/coerce.js';

describe('str', () => {
  it('returns a trimmed non-empty string', () => {
    expect(str('  hello  ')).toBe('hello');
    expect(str('x')).toBe('x');
  });
  it('returns undefined for empty or whitespace-only strings', () => {
    expect(str('')).toBeUndefined();
    expect(str('   ')).toBeUndefined();
  });
  it('returns undefined for non-string values', () => {
    expect(str(42)).toBeUndefined();
    expect(str(null)).toBeUndefined();
    expect(str(undefined)).toBeUndefined();
    expect(str({})).toBeUndefined();
  });
});

describe('num', () => {
  it('passes through a finite number', () => {
    expect(num(3.14)).toBe(3.14);
    expect(num(0)).toBe(0);
    expect(num(-1)).toBe(-1);
  });
  it('coerces a numeric string', () => {
    expect(num('42')).toBe(42);
    expect(num('3.5')).toBe(3.5);
  });
  it('returns undefined for Infinity and NaN', () => {
    expect(num(Infinity)).toBeUndefined();
    expect(num(-Infinity)).toBeUndefined();
    expect(num(NaN)).toBeUndefined();
    expect(num('Infinity')).toBeUndefined();
    expect(num('not-a-number')).toBeUndefined();
  });
  it('returns undefined for null, undefined, and empty string', () => {
    expect(num(null)).toBeUndefined();
    expect(num(undefined)).toBeUndefined();
    expect(num('')).toBeUndefined();
  });
});

describe('int', () => {
  it('truncates a float toward zero', () => {
    expect(int(3.9)).toBe(3);
    expect(int(-3.9)).toBe(-3);
  });
  it('returns undefined when num() returns undefined', () => {
    expect(int(null)).toBeUndefined();
    expect(int('bad')).toBeUndefined();
  });
});

describe('dateOf', () => {
  it('parses a valid ISO string to a Date', () => {
    const d = dateOf('2026-06-01T00:00:00.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d!.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });
  it('returns undefined for invalid date strings', () => {
    expect(dateOf('not-a-date')).toBeUndefined();
    expect(dateOf('')).toBeUndefined();
    expect(dateOf('   ')).toBeUndefined();
  });
  it('returns undefined for non-string values', () => {
    expect(dateOf(null)).toBeUndefined();
    expect(dateOf(undefined)).toBeUndefined();
    expect(dateOf(12345)).toBeUndefined();
  });
});
