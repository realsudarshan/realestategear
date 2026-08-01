import '../scripts/loadEnv.js';
import { prisma, PropertyType, ListingStatus } from '../index.js';
import { requireDemoSeedOptIn } from '../scripts/seedGuard.js';

// Populates the Example Realty demo portal with enough varied, realistic-looking
// listings (across all 9 golf communities in apps/portal's content) to
// preview /properties search and filtering without waiting on real MLS data.
// Self-hosters: run this against your own dev DB to see the portal template
// as a working demo before your MLS/IDX access is approved.
//
// Idempotent-ish: skips entirely if the demo segment already exists, so
// re-running `npm run db:seed:demo-listings` won't pile up duplicates.

const PORTAL_SLUG = 'example-realty';
const SEGMENT_NAME = 'Demo Listings — Golf Communities';

const IMAGES = [
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
  'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=800',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
];

// Mirrors apps/portal/content/communities/*.mdx (name, subArea, priceRange).
const COMMUNITIES = [
  { name: 'Birkdale', city: 'Huntersville', state: 'NC', zip: '28078', min: 450_000, max: 1_200_000 },
  { name: 'The Peninsula', city: 'Cornelius', state: 'NC', zip: '28031', min: 700_000, max: 4_000_000 },
  { name: 'The Point', city: 'Mooresville', state: 'NC', zip: '28117', min: 900_000, max: 6_000_000 },
  { name: 'Ballantyne Country Club', city: 'Charlotte', state: 'NC', zip: '28277', min: 800_000, max: 3_000_000 },
  { name: 'Piper Glen', city: 'Charlotte', state: 'NC', zip: '28277', min: 600_000, max: 2_000_000 },
  { name: 'Providence Country Club', city: 'Charlotte', state: 'NC', zip: '28277', min: 650_000, max: 2_500_000 },
  { name: 'Firethorne', city: 'Marvin', state: 'NC', zip: '28173', min: 500_000, max: 1_500_000 },
  { name: 'Longview', city: 'Waxhaw', state: 'NC', zip: '28173', min: 700_000, max: 3_000_000 },
  { name: 'Tega Cay', city: 'Tega Cay', state: 'SC', zip: '29708', min: 400_000, max: 1_200_000 },
];

const PROPERTY_TYPE_WEIGHTS = [
  PropertyType.SINGLE_FAMILY,
  PropertyType.SINGLE_FAMILY,
  PropertyType.SINGLE_FAMILY,
  PropertyType.TOWNHOUSE,
  PropertyType.CONDO,
];

const STREET_NAMES = [
  'Fairway', 'Clubhouse', 'Lakeshore', 'Magnolia', 'Heron', 'Sunset Ridge',
  'Wintergreen', 'Cedar Hollow', 'Windward', 'Harborview',
];
const STREET_SUFFIXES = ['Dr', 'Ln', 'Ct', 'Way', 'Rd'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInRange(min: number, max: number, step = 1): number {
  const steps = Math.floor((max - min) / step);
  return min + Math.floor(Math.random() * (steps + 1)) * step;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  requireDemoSeedOptIn();
  const portal = await prisma.portal.findUnique({ where: { slug: PORTAL_SLUG } });
  if (!portal) {
    console.error(`❌ No portal with slug "${PORTAL_SLUG}" found. Run \`npm run db:seed:portal\` first.`);
    process.exit(1);
  }

  const existingCollection = await prisma.listingCollection.findUnique({ where: { portalId_slug: { portalId: portal.id, slug: 'demo-communities' } } });
  if (existingCollection) { console.log(`⏭️  "${SEGMENT_NAME}" already exists (${existingCollection.id}) — skipping.`); return; }
  const collection = await prisma.listingCollection.create({ data: { portalId: portal.id, slug: 'demo-communities', name: SEGMENT_NAME, predicate: {} } });
  console.log(`Created listing collection "${SEGMENT_NAME}" (${collection.id}) for portal ${portal.slug}`);

  let created = 0;
  for (const community of COMMUNITIES) {
    const count = randomInRange(3, 5);
    for (let i = 0; i < count; i++) {
      const propertyType = pick(PROPERTY_TYPE_WEIGHTS);
      const price = randomInRange(community.min, community.max, 5000);
      const bedrooms = propertyType === PropertyType.CONDO ? randomInRange(1, 3) : randomInRange(3, 6);
      const bathrooms = Math.max(1.5, Math.round((bedrooms - randomInRange(0, 1)) * 2) / 2);
      const squareFeet =
        propertyType === PropertyType.CONDO
          ? randomInRange(700, 1800, 50)
          : randomInRange(1800, 6000, 100);
      const yearBuilt = randomInRange(1998, 2023);
      const address = `${randomInRange(10, 9999)} ${pick(STREET_NAMES)} ${pick(STREET_SUFFIXES)}`;

      const property = await prisma.property.create({
        data: {
          address,
          city: community.city,
          state: community.state,
          zipCode: community.zip,
          subdivision: community.name,
          propertyType,
          bedrooms,
          bathrooms,
          squareFeet,
          yearBuilt,
        },
      });

      const kind =
        propertyType === PropertyType.CONDO
          ? 'A stylish condo'
          : propertyType === PropertyType.TOWNHOUSE
            ? 'A well-kept townhome'
            : 'A spacious single-family home';

      await prisma.listing.create({
        data: {
          propertyId: property.id,
          source: 'MANUAL',
          accountId: portal.accountId,
          slug: `${slugify(address)}-${slugify(community.city)}-${property.id.slice(-6)}`,
          listPrice: price,
          status: ListingStatus.ACTIVE,
          idxDisplayable: true,
          imageUrl: pick(IMAGES),
          description: `${kind} in ${community.name}, ${community.city}.`,
          brokerageName: 'Example Realty',
          brokeragePhone: '(555) 555-0100',
          listDate: new Date(Date.now() - randomInRange(1, 45) * 24 * 60 * 60 * 1000),
        },
      });
      created++;
    }
  }

  console.log(`✅ Created ${created} demo listings across ${COMMUNITIES.length} communities.`);
  console.log('   View them at http://localhost:3006/properties');
}

main()
  .catch((e) => {
    console.error('❌ Demo listings seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
