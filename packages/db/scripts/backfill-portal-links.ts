/**
 * One-time backfill: link existing Contact rows to User rows by email.
 *
 * Run after deploying the portal_crm_bridge migration:
 *   node packages/db/scripts/backfill-portal-links.js
 */
import './loadEnv.js';
import { prisma } from '../index.js';

async function main() {
  const contacts = await prisma.contact.findMany({
    where: { email: { not: null }, portalUserId: null },
    select: { id: true, email: true, assignedAgentId: true },
  });

  console.log(`Found ${contacts.length} contacts with email and no portal link.`);

  let matched = 0;
  let skipped = 0;
  let errors = 0;

  for (const contact of contacts) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: contact.email.toLowerCase() },
        select: { id: true },
      });

      if (!user) {
        skipped++;
        continue;
      }

      const existing = await prisma.contact.findFirst({
        where: {
          assignedAgentId: contact.assignedAgentId,
          portalUserId: user.id,
          id: { not: contact.id },
        },
      });
      if (existing) {
        console.log(
          `  Skip contact ${contact.id}: agent ${contact.assignedAgentId} already has a contact linked to user ${user.id}`
        );
        skipped++;
        continue;
      }

      await prisma.contact.update({
        where: { id: contact.id },
        data: { portalUserId: user.id },
      });
      matched++;
    } catch (err) {
      console.error(`  Error linking contact ${contact.id}:`, err.message);
      errors++;
    }
  }

  console.log(`\nBackfill complete: ${matched} linked, ${skipped} skipped, ${errors} errors.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
