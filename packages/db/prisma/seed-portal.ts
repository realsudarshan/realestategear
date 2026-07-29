import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../index.js';
import { requireDemoSeedOptIn } from '../scripts/seedGuard.js';

// Idempotent: can be re-run against dev or prod.
// Creates the "Example Realty" Account + owner User + Portal row that the
// apps/portal template (lib/portal.ts's PORTAL_SLUG) expects to find.
// Self-hosters: copy this file, change SLUG/EMAIL/names to your own.

const SLUG = 'example-realty';
const EMAIL = 'owner@example.com';
const TEMP_PASSWORD = 'portal-change-me-before-use';

async function main() {
  requireDemoSeedOptIn();
  console.log('🌱 Seeding Example Realty portal...');

  // ── Account ─────────────────────────────────────────────────────────────────
  const existing = await prisma.account.findFirst({
    where: { name: 'Example Realty' },
  });

  let account = existing;
  if (!account) {
    account = await prisma.account.create({
      data: { name: 'Example Realty' },
    });
    console.log(`🏢 Created account: ${account.id}`);
  } else {
    console.log(`🏢 Reusing account: ${account.id}`);
  }

  // ── Owner user ───────────────────────────────────────────────────────────────
  let user = await prisma.user.findFirst({ where: { email: EMAIL } });
  if (!user) {
    const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 12);
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        password: hashedPassword,
        firstName: 'ABC',
        lastName: 'Realty',
        role: 'AGENT',
        emailVerified: true,
        accountId: account.id,
      },
    });
    console.log(`👤 Created user: ${user.email}`);
    console.log(`🔑 Temp password: ${TEMP_PASSWORD}  ← change this in prod`);
  } else {
    console.log(`👤 Reusing user: ${user.email}`);
  }

  // ── AccountMember ────────────────────────────────────────────────────────────
  await prisma.accountMember.upsert({
    where: { accountId_userId: { accountId: account.id, userId: user.id } },
    create: { accountId: account.id, userId: user.id, role: 'OWNER' },
    update: { role: 'OWNER' },
  });
  console.log('👑 AccountMember OWNER confirmed');

  // ── Portal ───────────────────────────────────────────────────────────────────
  const portal = await prisma.portal.upsert({
    where: { slug: SLUG },
    create: {
      slug: SLUG,
      name: 'Example Realty',
      accountId: account.id,
      agentEmail: EMAIL,
      agentDisplayName: 'Example Realty',
      brokerageName: 'Example Realty',
      brokeragePhone: '(555) 555-0100',
      isActive: true,
    },
    update: {
      // Update key fields if re-run; keep isActive stable so a re-run
      // doesn't flip a production portal off.
      name: 'Example Realty',
      agentEmail: EMAIL,
      agentDisplayName: 'Example Realty',
      brokerageName: 'Example Realty',
      brokeragePhone: '(555) 555-0100',
      isActive: true,
    },
  });

  console.log(`🌐 Portal upserted: ${portal.slug} (isActive=${portal.isActive})`);
  console.log('\n✅ Portal seed complete.');
  console.log('   Inquiry endpoint: POST /api/portals/example-realty/inquiries');
  console.log(`   Notifications → ${EMAIL}`);
}

main()
  .catch((e) => {
    console.error('❌ Portal seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
