import { prisma } from 'db';

/**
 * Incremental watermark per (provider, resource). `lastSyncAt` stores the greatest
 * ModificationTimestamp actually seen (server clock), not the client clock (D4).
 *
 * On read we subtract a small overlap so the next run re-fetches the boundary
 * window. That closes the tie bug (records sharing the exact max timestamp that
 * arrive just after we recorded it would otherwise be skipped by `gt` — Codex #1);
 * re-processing the overlap is harmless because the upsert is idempotent.
 */
const OVERLAP_MS = 60_000;

export async function getCursor(providerId: string, resource: string): Promise<Date | undefined> {
  const row = await prisma.syncCursor.findUnique({
    where: { providerId_resource: { providerId, resource } },
  });
  if (!row) return undefined;
  return new Date(row.lastSyncAt.getTime() - OVERLAP_MS);
}

export async function updateCursor(providerId: string, resource: string, watermark: Date): Promise<void> {
  await prisma.syncCursor.upsert({
    where: { providerId_resource: { providerId, resource } },
    create: { providerId, resource, lastSyncAt: watermark },
    update: { lastSyncAt: watermark },
  });
}
