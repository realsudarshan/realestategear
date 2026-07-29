import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Server-side object storage for downloaded MLS media (R2-style S3, same STORAGE_*
 * config as apps/api). mls-service downloads photos from MLS Grid and PutObjects
 * them here (no presigned URLs — it has the bytes). Public URLs are served from
 * STORAGE_PUBLIC_BASE_URL.
 */

let _client: S3Client | null = null;

function client(): S3Client {
  if (!_client) {
    const endpoint = process.env.STORAGE_ENDPOINT;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY;
    const secretAccessKey = process.env.STORAGE_SECRET_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('Storage not configured (STORAGE_ENDPOINT / STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY)');
    }
    _client = new S3Client({ endpoint, region: 'auto', credentials: { accessKeyId, secretAccessKey } });
  }
  return _client;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY &&
      process.env.STORAGE_SECRET_KEY,
  );
}

/** The public, servable URL for a stored key. */
export function publicUrl(key: string): string {
  const base = (process.env.STORAGE_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  return `${base}/${key}`;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<string> {
  const Bucket = process.env.STORAGE_BUCKET as string;
  await client().send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
  return publicUrl(key);
}

export async function deleteObject(key: string): Promise<void> {
  const Bucket = process.env.STORAGE_BUCKET as string;
  await client().send(new DeleteObjectCommand({ Bucket, Key: key }));
}
