import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processPropertyRecord: vi.fn(),
  getCursor: vi.fn(async () => undefined),
  updateCursor: vi.fn(),
  failureCount: vi.fn(async () => 0),
  failureFindMany: vi.fn(async () => []),
  failureUpsert: vi.fn(),
  failureDeleteMany: vi.fn(),
}));

vi.mock('db', () => ({
  prisma: {
    mlsSyncFailure: {
      count: mocks.failureCount,
      findMany: mocks.failureFindMany,
      upsert: mocks.failureUpsert,
      deleteMany: mocks.failureDeleteMany,
    },
  },
  Prisma: {},
}));
vi.mock('../../../src/sync/cursor.js', () => ({
  getCursor: mocks.getCursor,
  updateCursor: mocks.updateCursor,
}));
vi.mock('../../../src/sync/persistence.js', () => ({
  processPropertyRecord: mocks.processPropertyRecord,
  SearchIndexReconciliationError: class SearchIndexReconciliationError extends Error {},
}));
vi.mock('../../../src/sync/roster.js', () => ({ upsertAgent: vi.fn(), upsertOffice: vi.fn() }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { SearchIndexReconciliationError } from '../../../src/sync/persistence.js';
import { retryFailures, runSync } from '../../../src/sync/runSync.js';

describe('runSync index metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MLS_SYNC_ENABLED;
    mocks.failureCount.mockResolvedValue(0);
    mocks.failureFindMany.mockResolvedValue([]);
  });

  it('classifies reconciliation exceptions as indexFailed and dead-letters the record', async () => {
    mocks.processPropertyRecord.mockRejectedValue(
      new SearchIndexReconciliationError('listing-1', 'post-commit', new Error('index failed')),
    );
    const connector = {
      async *fetchResource<T>() {
        yield [{ ListingKey: 'listing-1' }] as T[];
      },
    };

    const metrics = await runSync(
      'Property',
      {},
      { providerId: 'provider-1', mlsBoardId: 'board-1' },
      { connector },
    );

    expect(metrics.indexFailed).toBe(1);
    expect(metrics.failed).toBe(0);
    expect(mocks.failureUpsert).toHaveBeenCalledOnce();
  });

  it('retains a dead letter until reconciliation succeeds on retry', async () => {
    const failure = {
      externalId: 'listing-1',
      payload: { ListingKey: 'listing-1' },
    };
    mocks.failureFindMany.mockResolvedValue([failure]);
    mocks.processPropertyRecord.mockRejectedValueOnce(
      new SearchIndexReconciliationError('listing-1', 'post-commit', new Error('still down')),
    );

    await expect(retryFailures('Property', { providerId: 'provider-1', mlsBoardId: 'board-1' }))
      .resolves.toEqual({ retried: 1, recovered: 0 });
    expect(mocks.failureDeleteMany).not.toHaveBeenCalled();

    mocks.processPropertyRecord.mockResolvedValueOnce({ outcome: 'updated', listingKey: 'listing-1' });
    await expect(retryFailures('Property', { providerId: 'provider-1', mlsBoardId: 'board-1' }))
      .resolves.toEqual({ retried: 1, recovered: 1 });
    expect(mocks.failureDeleteMany).toHaveBeenCalledOnce();
  });
});
