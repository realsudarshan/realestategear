import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  syncCursor: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('db', () => ({ prisma: mockPrisma }));

const { getCursor, updateCursor } = await import('../../../src/sync/cursor.js');

const OVERLAP_MS = 60_000;

describe('getCursor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns undefined when no cursor row exists (first run)', async () => {
    mockPrisma.syncCursor.findUnique.mockResolvedValue(null);
    expect(await getCursor('mlsgrid', 'Property')).toBeUndefined();
  });

  it('returns lastSyncAt minus OVERLAP_MS to close the tie-bug window (Codex #1)', async () => {
    const stored = new Date('2026-06-01T12:00:00.000Z');
    mockPrisma.syncCursor.findUnique.mockResolvedValue({ lastSyncAt: stored });
    const result = await getCursor('mlsgrid', 'Property');
    expect(result).toBeInstanceOf(Date);
    // The returned watermark must be exactly OVERLAP_MS before the stored value.
    expect(result!.getTime()).toBe(stored.getTime() - OVERLAP_MS);
  });

  it('queries with the correct compound key', async () => {
    mockPrisma.syncCursor.findUnique.mockResolvedValue(null);
    await getCursor('mlsgrid', 'Member');
    expect(mockPrisma.syncCursor.findUnique).toHaveBeenCalledWith({
      where: { providerId_resource: { providerId: 'mlsgrid', resource: 'Member' } },
    });
  });
});

describe('updateCursor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts the watermark for a new row', async () => {
    mockPrisma.syncCursor.upsert.mockResolvedValue({});
    const ts = new Date('2026-06-01T15:00:00.000Z');
    await updateCursor('mlsgrid', 'Property', ts);
    expect(mockPrisma.syncCursor.upsert).toHaveBeenCalledWith({
      where: { providerId_resource: { providerId: 'mlsgrid', resource: 'Property' } },
      create: { providerId: 'mlsgrid', resource: 'Property', lastSyncAt: ts },
      update: { lastSyncAt: ts },
    });
  });

  it('stores the raw watermark (no OVERLAP_MS subtraction on write)', async () => {
    mockPrisma.syncCursor.upsert.mockResolvedValue({});
    const ts = new Date('2026-06-02T00:00:00.000Z');
    await updateCursor('mlsgrid', 'Office', ts);
    const call = mockPrisma.syncCursor.upsert.mock.calls[0][0];
    expect(call.create.lastSyncAt).toEqual(ts);
    expect(call.update.lastSyncAt).toEqual(ts);
  });
});
