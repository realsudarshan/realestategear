import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  delete: vi.fn(),
  import: vi.fn(),
  export: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('./typesenseClient.js', () => ({
  default: {
    collections: vi.fn(() => ({
      documents: vi.fn((id?: string) => id
        ? { delete: () => mocks.delete(id) }
        : { upsert: mocks.upsert, import: mocks.import, export: mocks.export }),
    })),
  },
}));

vi.mock('./logger.js', () => ({ default: mocks.logger, logger: mocks.logger }));

import { deleteDocument, reindexAll, upsertDocument } from './syncService.js';

describe('syncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.import.mockResolvedValue([]);
    mocks.export.mockResolvedValue('');
    mocks.delete.mockResolvedValue({ id: 'deleted' });
  });

  it('logs and rethrows upsert failures', async () => {
    const error = new Error('upsert failed');
    mocks.upsert.mockRejectedValueOnce(error);

    await expect(upsertDocument('properties', { id: 'p1' })).rejects.toBe(error);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Typesense upsert failed [properties:p1]',
      error,
    );
  });

  it('treats delete 404 as success and rethrows other failures', async () => {
    mocks.delete.mockRejectedValueOnce({ httpStatus: 404 });
    await expect(deleteDocument('properties', 'missing')).resolves.toBeUndefined();
    expect(mocks.logger.error).not.toHaveBeenCalled();

    const error = Object.assign(new Error('unavailable'), { httpStatus: 503 });
    mocks.delete.mockRejectedValueOnce(error);
    await expect(deleteDocument('properties', 'p1')).rejects.toBe(error);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Typesense delete failed [properties:p1]',
      error,
    );
  });

  it('upserts desired documents and deletes only stale exported IDs', async () => {
    const docs = [{ id: 'keep', address: '1 Main St' }, { id: 'new', address: '2 Main St' }];
    const fetchDocs = vi.fn().mockResolvedValue(docs);
    mocks.import.mockResolvedValueOnce([{ success: true }, { success: true }]);
    mocks.export.mockResolvedValueOnce('{"id":"keep"}\n{"id":"stale"}\n{"id":"new"}\n');

    const reconcile = vi.fn().mockResolvedValue(undefined);
    await expect(reindexAll('properties', fetchDocs, { exact: true, reconcile })).resolves.toEqual({
      desiredCount: 2,
      upsertedCount: 2,
      deletedCount: 1,
    });
    expect(mocks.import).toHaveBeenCalledWith(docs, { action: 'upsert', throwOnFail: false });
    expect(mocks.export).toHaveBeenCalledWith({ include_fields: 'id' });
    expect(mocks.export.mock.invocationCallOrder[0]).toBeLessThan(fetchDocs.mock.invocationCallOrder[0]);
    expect(mocks.export.mock.invocationCallOrder[0]).toBeLessThan(mocks.import.mock.invocationCallOrder[0]);
    expect(reconcile).toHaveBeenCalledWith('keep');
    expect(reconcile).toHaveBeenCalledWith('new');
    expect(reconcile).toHaveBeenCalledWith('stale');
    expect(mocks.import.mock.invocationCallOrder[0]).toBeLessThan(mocks.delete.mock.invocationCallOrder[0]);
    expect(mocks.delete.mock.invocationCallOrder[0]).toBeLessThan(reconcile.mock.invocationCallOrder[0]);
    expect(mocks.delete).toHaveBeenCalledTimes(1);
    expect(mocks.delete).toHaveBeenCalledWith('stale');
    expect(mocks.delete).not.toHaveBeenCalledWith('keep');
    expect(mocks.delete).not.toHaveBeenCalledWith('new');
  });

  it('deletes every preexisting document for an empty exact property set', async () => {
    const fetchDocs = vi.fn().mockResolvedValue([]);
    mocks.export.mockResolvedValueOnce('{"id":"stale-1"}\n{"id":"stale-2"}');

    await expect(reindexAll('properties', fetchDocs, { exact: true })).resolves.toEqual({
      desiredCount: 0,
      upsertedCount: 0,
      deletedCount: 2,
    });
    expect(fetchDocs).toHaveBeenCalledOnce();
    expect(mocks.import).not.toHaveBeenCalled();
    expect(mocks.delete).toHaveBeenCalledTimes(2);
  });

  it('preserves upsert-only semantics for ordinary non-property reindexing', async () => {
    const docs = [{ id: 'contact-1' }];
    mocks.import.mockResolvedValueOnce([{ success: true }]);

    await expect(reindexAll('contacts', async () => docs)).resolves.toEqual({
      desiredCount: 1,
      upsertedCount: 1,
      deletedCount: 0,
    });
    expect(mocks.export).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('throws on partial import failure without deleting', async () => {
    mocks.import.mockResolvedValueOnce([
      { success: true },
      { success: false, error: 'bad document', code: 400 },
    ]);

    await expect(reindexAll('properties', async () => [{ id: 'p1' }, { id: 'p2' }]))
      .rejects.toThrow('failed for 1/2 documents');
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('throws on malformed export JSONL before deleting anything', async () => {
    mocks.import.mockResolvedValueOnce([{ success: true }]);
    mocks.export.mockResolvedValueOnce('{"id":"p1"}\nnot-json');

    await expect(reindexAll('properties', async () => [{ id: 'p1' }], { exact: true }))
      .rejects.toThrow('invalid JSON on line 2');
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});
