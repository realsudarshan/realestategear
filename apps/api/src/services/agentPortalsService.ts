import { prisma } from 'db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getPortalReadiness } from './portalReadinessService.js';
import logger from '../utils/logger.js';

const RESERVED_SLUGS = new Set(['www', 'api', 'app', 'admin', 'mail', 'portal']);
const SLUG_REGEX = /^[a-z0-9-]+$/;

export function validateSlug(slug: string): string | null {
  if (!slug) return 'Slug is required';
  if (!SLUG_REGEX.test(slug)) return 'Slug may only contain lowercase letters, numbers, and hyphens';
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" is a reserved slug`;
  return null;
}

export async function checkOwnership(portalId: string, userId: string) {
  const portal = await prisma.portal.findUnique({ where: { id: portalId } });
  if (!portal) {
    const err: any = new Error('Portal not found');
    err.statusCode = 404;
    throw err;
  }
  const member = await prisma.accountMember.findFirst({
    where: { accountId: portal.accountId, userId },
  });
  if (!member) {
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return portal;
}

export async function generateLogoUploadUrl(portalId: string, agentId: string, contentType: string): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    const err: any = new Error('Only JPEG, PNG, or WebP images are allowed');
    err.statusCode = 400;
    throw err;
  }

  await checkOwnership(portalId, agentId);

  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKey = process.env.STORAGE_ACCESS_KEY;
  const secretKey = process.env.STORAGE_SECRET_KEY;

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    const err: any = new Error('Storage not configured');
    err.statusCode = 503;
    throw err;
  }

  const client = new S3Client({
    endpoint,
    region: 'auto',
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const key = `portals/${portalId}/logo.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn: 900 });
  return url;
}

export async function validateFeaturedListingAccess(portalId: string, listingId: string, userId: string): Promise<void> {
  await checkOwnership(portalId, userId);

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) {
    const err: any = new Error('Listing not found');
    err.statusCode = 404;
    throw err;
  }
}

export async function validateActivation(portal: any): Promise<string | null> {
  if (!portal.slug) return 'Slug is required to activate a portal';
  if (!portal.agentEmail) return 'Agent email is required to activate a portal (needed for inquiry notifications)';
  if (!portal.id) return null;

  const portalWithCollections = await prisma.portal.findUnique({
    where: { id: portal.id },
    select: {
      id: true,
      accountId: true,
      slug: true,
      isActive: true,
      agentEmail: true,
      brokerageName: true,
      brokeragePhone: true,
      collections: { select: { id: true, predicate: true, isPublished: true } },
    },
  });

  if (!portalWithCollections) return 'Portal not found';
  const readiness = await getPortalReadiness({
    ...portalWithCollections,
    ...portal,
  });
  const blocker = readiness.blockers[0];
  if (blocker) return blocker.reason ?? blocker.label;
  return null;
}
