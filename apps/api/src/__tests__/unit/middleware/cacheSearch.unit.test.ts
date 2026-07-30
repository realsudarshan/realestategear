import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const cacheManager = vi.hoisted(() => ({
  get: vi.fn(async () => null),
  set: vi.fn(async () => undefined),
  generateSearchKey: vi.fn(() => 'key'),
}));
vi.mock('cache', () => ({ default: cacheManager }));
vi.mock('db', () => ({ ListingStatus: { ACTIVE: 'ACTIVE' }, ListingSource: { MLS: 'MLS' } }));
vi.mock('../../../utils/logger.js', () => ({ default: { debug: vi.fn(), error: vi.fn() } }));

import { cacheSearch } from '../../../middleware/cache.js';

const originalDisplay = process.env.MLS_PUBLIC_DISPLAY_ENABLED;

describe('cacheSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
  });

  afterAll(() => {
    if (originalDisplay === undefined) delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
    else process.env.MLS_PUBLIC_DISPLAY_ENABLED = originalDisplay;
  });

  it('includes the effective MLS public display state in the cache policy key', async () => {
    const req = { method: 'GET', query: { q: 'home', city: 'Charlotte' } } as never;
    const res = { setHeader: vi.fn(), json: vi.fn(), statusCode: 200 } as never;
    const next = vi.fn();

    await cacheSearch(req, res, next);
    expect(cacheManager.generateSearchKey).toHaveBeenLastCalledWith('home', {
      city: 'Charlotte',
      mlsPublicDisplayEnabled: false,
    });

    process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'true';
    await cacheSearch(req, res, next);
    expect(cacheManager.generateSearchKey).toHaveBeenLastCalledWith('home', {
      city: 'Charlotte',
      mlsPublicDisplayEnabled: true,
    });
  });
});
