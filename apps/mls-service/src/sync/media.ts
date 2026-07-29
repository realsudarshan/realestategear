import axios from 'axios';
import { prisma } from 'db';
import logger from '../utils/logger.js';
import { str, int, dateOf } from './coerce.js';
import { putObject as s3PutObject } from '../storage/s3.js';

/**
 * Media (photo) sync for a Property record (decision D7 / Codex #9).
 *
 * MLS Grid FORBIDS hotlinking MediaURL — each image must be downloaded with the
 * OAuth token in the `User-Agent` header and re-hosted. We download to S3, replace
 * the property's Media rows, and return the primary imageUrl. Re-download is skipped
 * unless the record's PhotosChangeTimestamp is newer than what we last ingested
 * (Property.photosSyncedAt), so routine listing updates don't re-pull every photo.
 */

export interface MediaItem {
  MediaURL?: string;
  Order?: number;
  ShortDescription?: string;
  [key: string]: unknown;
}

export interface MediaDownload {
  body: Uint8Array;
  contentType: string;
}

export interface MediaDeps {
  /** Download an image (auth via User-Agent). Injectable for tests. */
  fetchImage: (url: string, accessToken: string) => Promise<MediaDownload>;
  /** Store bytes, return the public URL. */
  putObject: (key: string, body: Uint8Array, contentType: string) => Promise<string>;
}

export interface MediaConfig {
  /** Board identity — S3 key namespace. */
  mlsBoardId: string;
  /** Static bearer token, sent as the User-Agent on media downloads (MLS Grid's no-hotlink rule). */
  accessToken: string;
  concurrency?: number;
}

export interface MediaResult {
  /** Primary photo's public URL, or null when there are no photos. */
  imageUrl: string | null;
  /** false when media was unchanged and skipped. */
  changed: boolean;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function extFor(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

async function downloadImage(url: string, accessToken: string): Promise<MediaDownload> {
  // Per MLS Grid: the User-Agent MUST be the OAuth access token to fetch MediaURL.
  const resp = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': accessToken, 'Accept-Encoding': 'gzip' },
    timeout: 30_000,
  });
  const contentType = String(resp.headers['content-type'] ?? 'image/jpeg');
  return { body: new Uint8Array(resp.data), contentType };
}

const defaultDeps: MediaDeps = { fetchImage: downloadImage, putObject: s3PutObject };

export async function syncPropertyMedia(
  record: Record<string, unknown>,
  propertyId: string,
  listingKey: string,
  config: MediaConfig,
  deps: MediaDeps = defaultDeps,
): Promise<MediaResult> {
  const photosChangedAt = dateOf(record.PhotosChangeTimestamp);

  // Skip unchanged photos (D7 / Codex #9): only re-pull when the source photo
  // timestamp advanced past what we last ingested.
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { photosSyncedAt: true },
  });
  const lastSynced = property?.photosSyncedAt ?? null;
  if (photosChangedAt && lastSynced && photosChangedAt <= lastSynced) {
    return { imageUrl: null, changed: false };
  }

  const items = Array.isArray(record.Media) ? (record.Media as MediaItem[]) : [];
  const ordered = items
    .filter((m) => str(m.MediaURL))
    .sort((a, b) => (int(a.Order) ?? 0) - (int(b.Order) ?? 0));

  if (ordered.length === 0) return { imageUrl: null, changed: false };

  // Download + re-host with bounded concurrency (media fetches hit MLS Grid — D15).
  const concurrency = config.concurrency ?? 4;
  const uploaded: { url: string; order: number; caption: string | null }[] = [];
  for (let i = 0; i < ordered.length; i += concurrency) {
    const chunk = ordered.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (item, j) => {
        const order = int(item.Order) ?? i + j;
        const url = str(item.MediaURL) as string;
        try {
          const { body, contentType } = await deps.fetchImage(url, config.accessToken);
          const key = `mls/${config.mlsBoardId}/${listingKey}/${order}.${extFor(contentType)}`;
          const publicUrl = await deps.putObject(key, body, contentType);
          return { url: publicUrl, order, caption: str(item.ShortDescription) ?? null };
        } catch (err) {
          logger.warn('[mlsgrid] media download/upload failed', { listingKey, order, error: errMsg(err) });
          return null;
        }
      }),
    );
    for (const r of results) if (r) uploaded.push(r);
  }

  if (uploaded.length === 0) {
    logger.warn('[mlsgrid] no media uploaded (all downloads failed)', { listingKey });
    return { imageUrl: null, changed: false };
  }
  uploaded.sort((a, b) => a.order - b.order);

  // Replace the property's photos atomically + stamp the watermark.
  await prisma.$transaction([
    prisma.media.deleteMany({ where: { propertyId } }),
    ...uploaded.map((u) =>
      prisma.media.create({ data: { propertyId, url: u.url, order: u.order, caption: u.caption } }),
    ),
    prisma.property.update({
      where: { id: propertyId },
      data: { photosSyncedAt: photosChangedAt ?? new Date() },
    }),
  ]);

  return { imageUrl: uploaded[0].url, changed: true };
}
