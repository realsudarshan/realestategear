import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from 'db';
import { syncPropertyMedia, type MediaDeps, type MediaConfig } from '../../../src/sync/media.js';

const config: MediaConfig = { mlsBoardId: 'carolina', accessToken: 'tok-123' };

function makeDeps(): MediaDeps & { fetchImage: ReturnType<typeof vi.fn>; putObject: ReturnType<typeof vi.fn> } {
  const fetchImage = vi.fn(async () => ({ body: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' }));
  const putObject = vi.fn(async (key: string) => `https://cdn.test/${key}`);
  return { fetchImage, putObject };
}

async function makeProperty(): Promise<string> {
  const p = await prisma.property.create({
    data: { address: '1 Main St', city: 'Charlotte', state: 'NC', zipCode: '28202' },
  });
  return p.id;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Property", "Media" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('syncPropertyMedia (D7)', () => {
  it('downloads each photo (token via User-Agent), stores ordered Media, returns the primary url', async () => {
    const propertyId = await makeProperty();
    const deps = makeDeps();
    const record = {
      PhotosChangeTimestamp: '2026-06-05T00:00:00.000Z',
      Media: [
        { MediaURL: 'https://mls/p2', Order: 2 },
        { MediaURL: 'https://mls/p0', Order: 0 },
        { MediaURL: 'https://mls/p1', Order: 1 },
      ],
    };

    const result = await syncPropertyMedia(record, propertyId, 'CAR123', config, deps);

    expect(result.changed).toBe(true);
    // primary = order 0
    expect(result.imageUrl).toBe('https://cdn.test/mls/carolina/CAR123/0.jpg');
    // no-hotlink: the OAuth token is passed for the User-Agent on every download
    expect(deps.fetchImage).toHaveBeenCalledTimes(3);
    expect(deps.fetchImage.mock.calls.every((c) => c[1] === 'tok-123')).toBe(true);

    const media = await prisma.media.findMany({ where: { propertyId }, orderBy: { order: 'asc' } });
    expect(media.map((m) => m.order)).toEqual([0, 1, 2]);
    expect(media[0].url).toBe('https://cdn.test/mls/carolina/CAR123/0.jpg');

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    expect(property?.photosSyncedAt?.toISOString()).toBe('2026-06-05T00:00:00.000Z');
  });

  it('skips re-download when PhotosChangeTimestamp is not newer than photosSyncedAt', async () => {
    const propertyId = await makeProperty();
    await prisma.property.update({
      where: { id: propertyId },
      data: { photosSyncedAt: new Date('2026-06-10T00:00:00.000Z') }, // newer than the record
    });
    const deps = makeDeps();

    const result = await syncPropertyMedia(
      { PhotosChangeTimestamp: '2026-06-05T00:00:00.000Z', Media: [{ MediaURL: 'https://mls/p0', Order: 0 }] },
      propertyId,
      'CAR123',
      config,
      deps,
    );

    expect(result).toEqual({ imageUrl: null, changed: false });
    expect(deps.fetchImage).not.toHaveBeenCalled();
  });

  it('replaces existing photos on a refresh', async () => {
    const propertyId = await makeProperty();
    await prisma.media.create({ data: { propertyId, url: 'https://old/0', order: 0 } });
    await prisma.media.create({ data: { propertyId, url: 'https://old/1', order: 1 } });
    const deps = makeDeps();

    await syncPropertyMedia(
      { PhotosChangeTimestamp: '2026-06-09T00:00:00.000Z', Media: [{ MediaURL: 'https://mls/new', Order: 0 }] },
      propertyId,
      'CAR123',
      config,
      deps,
    );

    const media = await prisma.media.findMany({ where: { propertyId } });
    expect(media).toHaveLength(1);
    expect(media[0].url).toBe('https://cdn.test/mls/carolina/CAR123/0.jpg');
  });

  it('returns no image when the record has no Media', async () => {
    const propertyId = await makeProperty();
    const deps = makeDeps();
    const result = await syncPropertyMedia({ PhotosChangeTimestamp: '2026-06-05T00:00:00.000Z' }, propertyId, 'CAR123', config, deps);
    expect(result).toEqual({ imageUrl: null, changed: false });
    expect(deps.fetchImage).not.toHaveBeenCalled();
  });
});
