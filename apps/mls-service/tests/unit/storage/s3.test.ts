import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock AWS SDK before importing the module under test.
vi.mock('@aws-sdk/client-s3', () => {
  const send = vi.fn(async () => {});
  const S3Client = vi.fn(() => ({ send }));
  const PutObjectCommand = vi.fn((input: unknown) => ({ _type: 'PutObject', input }));
  const DeleteObjectCommand = vi.fn((input: unknown) => ({ _type: 'DeleteObject', input }));
  return { S3Client, PutObjectCommand, DeleteObjectCommand, _send: send };
});

import { S3Client } from '@aws-sdk/client-s3';

describe('isStorageConfigured', () => {
  const VARS = ['STORAGE_ENDPOINT', 'STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'];

  afterEach(() => VARS.forEach(v => delete process.env[v]));

  it('returns true when all four vars are set', async () => {
    VARS.forEach(v => (process.env[v] = 'x'));
    const { isStorageConfigured } = await import('../../../src/storage/s3.js');
    expect(isStorageConfigured()).toBe(true);
  });

  it('returns false when any var is missing', async () => {
    VARS.slice(0, 3).forEach(v => (process.env[v] = 'x'));
    // STORAGE_SECRET_KEY is missing
    const { isStorageConfigured } = await import('../../../src/storage/s3.js');
    expect(isStorageConfigured()).toBe(false);
  });
});

describe('publicUrl', () => {
  afterEach(() => delete process.env.STORAGE_PUBLIC_BASE_URL);

  it('concatenates base URL and key, stripping trailing slashes from base', async () => {
    process.env.STORAGE_PUBLIC_BASE_URL = 'https://cdn.example.com/';
    const { publicUrl } = await import('../../../src/storage/s3.js');
    expect(publicUrl('photos/abc.jpg')).toBe('https://cdn.example.com/photos/abc.jpg');
  });

  it('works when base URL has no trailing slash', async () => {
    process.env.STORAGE_PUBLIC_BASE_URL = 'https://cdn.example.com';
    const { publicUrl } = await import('../../../src/storage/s3.js');
    expect(publicUrl('img/x.png')).toBe('https://cdn.example.com/img/x.png');
  });

  it('uses an empty base when STORAGE_PUBLIC_BASE_URL is unset', async () => {
    delete process.env.STORAGE_PUBLIC_BASE_URL;
    const { publicUrl } = await import('../../../src/storage/s3.js');
    expect(publicUrl('k')).toBe('/k');
  });
});
