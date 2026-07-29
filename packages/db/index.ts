import { PrismaClient, Prisma } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

export { PrismaClient, Prisma };

// Re-export the generated schema enums (value + type) so consumers can import
// them type-safely from 'db' instead of reaching into the generated client.
export {
  MemberRole,
  PropertyType,
  ListingSource,
  ListingStatus,
  AIActionStatus,
  EventType,
  EventStatus,
  InquirySource,
  InquiryStatus,
  InquiryDeliveryState,
  ClassificationDecision,
  ClassificationSource,
  CollectionOverrideDecision,
  ClassificationRunMode,
  ClassificationRunStatus,
} from './generated/prisma/enums.js';

// Lazy-initialize PrismaClient so DATABASE_URL is read on first use,
// not at import time (ESM hoists imports before dotenv.config runs).
const globalForPrisma = globalThis;

function getClient() {
  if (!globalForPrisma.__prisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    globalForPrisma.__prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.__prisma;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return getClient()[prop as keyof PrismaClient];
  },
}) as PrismaClient;

export { prisma };

// Database package exports

/**
 * Generates an SEO-friendly URL slug from property address info
 * Example: "123 Main St, New York, NY" → "123-main-st-new-york-ny"
 * @param {Object} property - Property object with address, city, state
 * @returns {string} URL-safe slug
 */
export function generatePropertySlug(property) {
  const { address, city, state } = property;

  const cleanAddress = address
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/-+/g, '-')          // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens

  const cleanCity = city
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const stateCode = state.toLowerCase().replace(/[^a-z]/g, '');

  return `${cleanAddress}-${cleanCity}-${stateCode}`;
}

/**
 * Generates a unique slug by appending a counter if needed
 * @param {Object} property - Property object with address, city, state
 * @param {string[]} existingSlugs - Array of existing slugs to check against
 * @returns {string} Unique URL-safe slug
 */
export function generateUniquePropertySlug(property, existingSlugs = []) {
  const baseSlug = generatePropertySlug(property);
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
