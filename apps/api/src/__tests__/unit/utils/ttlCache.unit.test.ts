import { describe, it, expect } from 'vitest';
import { TtlCache } from '../../../utils/ttlCache.js';

describe('TtlCache', () => {
  it('returns null for unknown keys', () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000, maxSize: 10 });
    expect(cache.get('missing')).toBeNull();
  });

  it('returns set value before TTL expires', () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000, maxSize: 10 });
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('returns null and evicts after TTL expires', () => {
    let now = 1_000_000;
    const cache = new TtlCache<string, number>({ ttlMs: 100, maxSize: 10 }, () => now);
    cache.set('a', 1);
    now += 50;
    expect(cache.get('a')).toBe(1);
    now += 100; // total elapsed 150ms, past 100ms TTL
    expect(cache.get('a')).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('evicts oldest entry when maxSize is exceeded', () => {
    const cache = new TtlCache<string, string>({ ttlMs: 10_000, maxSize: 3 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.set('d', '4'); // should evict 'a' (oldest)
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
    expect(cache.get('d')).toBe('4');
    expect(cache.size()).toBe(3);
  });

  it('refreshes LRU position on get (touched entries survive eviction)', () => {
    const cache = new TtlCache<string, string>({ ttlMs: 10_000, maxSize: 3 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.get('a'); // touch — 'a' moves to end
    cache.set('d', '4'); // should now evict 'b' instead of 'a'
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeNull();
    expect(cache.get('c')).toBe('3');
    expect(cache.get('d')).toBe('4');
  });

  it('re-setting an existing key updates value and refreshes LRU position', () => {
    const cache = new TtlCache<string, string>({ ttlMs: 10_000, maxSize: 3 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.set('a', 'updated'); // re-set — moves 'a' to end
    cache.set('d', '4'); // should evict 'b' (now oldest)
    expect(cache.get('a')).toBe('updated');
    expect(cache.get('b')).toBeNull();
    expect(cache.size()).toBe(3);
  });
});
