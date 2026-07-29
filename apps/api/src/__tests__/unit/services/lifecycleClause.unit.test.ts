import { describe, it, expect } from 'vitest';
import { buildLifecycleClause } from '../../../services/lifecycleClause.js';

describe('buildLifecycleClause', () => {
  it('prospect → LEAD + stage NEW/CONTACTED', () => {
    expect(buildLifecycleClause('prospect')).toEqual({
      type: 'LEAD',
      stage: { in: ['NEW', 'CONTACTED'] },
    });
  });

  it('active-lead → LEAD + stage QUALIFIED/ACTIVE', () => {
    expect(buildLifecycleClause('active-lead')).toEqual({
      type: 'LEAD',
      stage: { in: ['QUALIFIED', 'ACTIVE'] },
    });
  });

  it('client → CLIENT only', () => {
    expect(buildLifecycleClause('client')).toEqual({ type: 'CLIENT' });
  });

  it('vendor → VENDOR only', () => {
    expect(buildLifecycleClause('vendor')).toEqual({ type: 'VENDOR' });
  });

  it('all → LEAD or CLIENT (no VENDOR)', () => {
    expect(buildLifecycleClause('all')).toEqual({
      type: { in: ['LEAD', 'CLIENT'] },
    });
  });

  it('throws 400 for unknown value', () => {
    expect(() => buildLifecycleClause('invalid')).toThrow('Invalid lifecycle');
    try {
      buildLifecycleClause('unknown');
    } catch (err) {
      expect((err as { status: number }).status).toBe(400);
    }
  });

  it('throws 400 for empty string', () => {
    expect(() => buildLifecycleClause('')).toThrow('Invalid lifecycle');
  });

  it('throws 400 for undefined', () => {
    expect(() => buildLifecycleClause(undefined)).toThrow('Invalid lifecycle');
  });
});
