/**
 * Backfill script to generate SEO-friendly slugs for existing properties
 * Run with: node prisma/backfill-slugs.js
 */
import 'dotenv/config';
import { prisma } from '../index.js';

/**
 * Generates an SEO-friendly URL slug from property address info
 */
function generatePropertySlug(property) {
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

async function backfillSlugs() {
  console.log('🔄 Starting slug backfill...');

  // Get all properties without slugs
  const properties = await prisma.property.findMany({
    where: { slug: null },
    select: { id: true, address: true, city: true, state: true }
  });

  console.log(`📊 Found ${properties.length} properties without slugs`);

  if (properties.length === 0) {
    console.log('✅ All properties already have slugs!');
    return;
  }

  // Get existing slugs to avoid duplicates
  const existingSlugsData = await prisma.property.findMany({
    where: { slug: { not: null } },
    select: { slug: true }
  });
  const existingSlugs = new Set(existingSlugsData.map(p => p.slug));

  let updated = 0;
  let errors = 0;

  for (const property of properties) {
    try {
      let slug = generatePropertySlug(property);

      // Ensure unique slug
      let counter = 1;
      const originalSlug = slug;
      while (existingSlugs.has(slug)) {
        slug = `${originalSlug}-${counter}`;
        counter++;
      }
      existingSlugs.add(slug);

      await prisma.property.update({
        where: { id: property.id },
        data: { slug }
      });

      updated++;
      if (updated % 100 === 0) {
        console.log(`📍 Updated ${updated}/${properties.length} properties...`);
      }
    } catch (error) {
      console.error(`❌ Error updating property ${property.id}:`, error.message);
      errors++;
    }
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`   Updated: ${updated} properties`);
  console.log(`   Errors: ${errors}`);
}

backfillSlugs()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
