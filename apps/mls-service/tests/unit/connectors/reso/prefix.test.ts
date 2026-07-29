import { describe, it, expect } from 'vitest';
import { stripPrefix, addPrefix } from '../../../../src/connectors/reso/prefix.js';

describe('board ID prefix helpers (D17)', () => {
  it('stripPrefix removes a leading board prefix', () => {
    expect(stripPrefix('ACT123456', 'ACT')).toBe('123456');
  });

  it('stripPrefix is a no-op when the value lacks the prefix', () => {
    expect(stripPrefix('123456', 'ACT')).toBe('123456');
  });

  it('stripPrefix is a no-op when the prefix is empty or undefined', () => {
    expect(stripPrefix('ACT123', '')).toBe('ACT123');
    expect(stripPrefix('ACT123', undefined)).toBe('ACT123');
  });

  it('addPrefix prepends the board prefix', () => {
    expect(addPrefix('123456', 'ACT')).toBe('ACT123456');
  });

  it('addPrefix is idempotent when already prefixed', () => {
    expect(addPrefix('ACT123456', 'ACT')).toBe('ACT123456');
  });

  it('round-trips: an agent-entered (de-prefixed) id can be queried then displayed', () => {
    const display = '123456';
    const forQuery = addPrefix(display, 'ACT'); // add before querying MLS Grid
    expect(forQuery).toBe('ACT123456');
    expect(stripPrefix(forQuery, 'ACT')).toBe(display); // strip for display
  });
});
