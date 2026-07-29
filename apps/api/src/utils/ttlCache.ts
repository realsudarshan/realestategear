// Simple TTL + LRU cache. In-process only; not shared across replicas.
// Use for short-lived (seconds-to-minutes) per-process memoization where the
// upstream call is expensive enough that even a 60s reuse window helps.
// For longer-lived or cross-replica caching, Redis is the answer instead.

interface Entry<V> {
  value: V;
  expires: number;
}

export interface TtlCacheOptions {
  /** Time-to-live in milliseconds. After this, get() returns null and evicts the entry. */
  ttlMs: number;
  /** Maximum entries to retain. Oldest (least-recently-set) entry is evicted on insert past this. */
  maxSize: number;
}

export class TtlCache<K extends string, V> {
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private readonly map = new Map<K, Entry<V>>();
  private readonly now: () => number;

  constructor(opts: TtlCacheOptions, now: () => number = Date.now) {
    this.ttlMs = opts.ttlMs;
    this.maxSize = opts.maxSize;
    this.now = now;
  }

  get(key: K): V | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expires <= this.now()) {
      this.map.delete(key);
      return null;
    }
    // Refresh LRU position: remove and re-insert moves to end of insertion order.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key); // Move to end on re-set.
    } else if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: this.now() + this.ttlMs });
  }

  /** Test-only: how many entries are currently held. */
  size(): number {
    return this.map.size;
  }

  /** Test-only: drop everything. */
  clear(): void {
    this.map.clear();
  }
}
