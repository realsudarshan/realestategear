import '../scripts/loadEnv.js';
import { prisma } from '../index.js';
import { requireDemoSeedOptIn } from '../scripts/seedGuard.js';

// ─── Name pools ──────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Linda', 'Michael', 'Barbara',
  'William', 'Elizabeth', 'David', 'Jennifer', 'Richard', 'Maria', 'Joseph',
  'Susan', 'Thomas', 'Margaret', 'Charles', 'Dorothy', 'Christopher', 'Lisa',
  'Daniel', 'Nancy', 'Matthew', 'Karen', 'Anthony', 'Betty', 'Mark', 'Helen',
  'Donald', 'Sandra', 'Steven', 'Donna', 'Paul', 'Carol', 'Andrew', 'Ruth',
  'Kenneth', 'Sharon', 'Joshua', 'Michelle', 'Kevin', 'Laura', 'Brian', 'Sarah',
  'George', 'Kimberly', 'Timothy', 'Deborah', 'Ronald', 'Jessica', 'Edward',
  'Shirley', 'Jason', 'Cynthia', 'Jeffrey', 'Angela', 'Ryan', 'Melissa',
  'Gary', 'Brenda', 'Nicholas', 'Amy', 'Eric', 'Anna', 'Jonathan', 'Rebecca',
  'Stephen', 'Virginia', 'Larry', 'Kathleen', 'Justin', 'Pamela', 'Scott',
  'Martha', 'Brandon', 'Debra', 'Frank', 'Amanda', 'Raymond', 'Stephanie',
  'Gregory', 'Carolyn', 'Samuel', 'Christine', 'Benjamin', 'Marie', 'Patrick',
  'Janet', 'Jack', 'Catherine', 'Dennis', 'Frances', 'Jerry', 'Ann',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson',
  'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez',
  'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis',
  'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres',
  'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall',
  'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Turner', 'Phillips',
  'Evans', 'Parker', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Murphy',
  'Cook', 'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed', 'Bailey', 'Bell',
  'Gomez', 'Kelly', 'Howard', 'Ward', 'Cox', 'Diaz', 'Richardson', 'Wood',
  'Watson', 'Brooks', 'Bennett', 'Gray', 'James', 'Reyes', 'Cruz', 'Hughes',
  'Price', 'Myers', 'Long', 'Foster', 'Sanders', 'Ross', 'Morales', 'Powell',
  'Sullivan', 'Russell', 'Ortiz', 'Jenkins', 'Gutierrez', 'Perry', 'Butler',
  'Barnes', 'Fisher', 'Henderson', 'Coleman', 'Simmons', 'Patterson',
];

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'hotmail.com'];

const SOURCES = ['referral', 'website', 'open-house', 'cold-call', 'social', 'zillow', 'realtor.com'];

const CHARLOTTE_STREETS = [
  '1234 Queens Road', '567 Providence Road', '890 Park Road', '234 Dilworth Road',
  '456 Sharon Amity Road', '789 Randolph Road', '321 Selwyn Avenue', '654 Colony Road',
  '987 Carmel Road', '147 Pineville Matthews Road', '258 Ballantyne Commons Pkwy',
  '369 Rea Road', '741 Johnston Road', '852 Ardrey Kell Road', '963 Waxhaw Pkwy',
  '159 Statesville Avenue', '357 Sugar Creek Road', '486 Eastway Drive',
  '753 Albemarle Road', '951 Monroe Road', '264 Central Avenue', '528 Independence Blvd',
  '816 Tyvola Road', '372 Sam Newell Road', '639 Old Monroe Road',
];

const CHARLOTTE_ZIPS = ['28202', '28203', '28204', '28205', '28207', '28209', '28210', '28211', '28226', '28277'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
}

const usedEmails = new Set<string>();
function uniqueEmail(first: string, last: string): string {
  const base = `${first.toLowerCase()}.${last.toLowerCase()}`;
  let email = `${base}@${pick(EMAIL_DOMAINS)}`;
  let i = 2;
  while (usedEmails.has(email)) {
    email = `${base}${i}@${pick(EMAIL_DOMAINS)}`;
    i++;
  }
  usedEmails.add(email);
  return email;
}

function phone(): string {
  return `(704) 555-${rand(1000, 9999)}`;
}

function charlotteAddress(): string {
  return `${pick(CHARLOTTE_STREETS)}, Charlotte, NC ${pick(CHARLOTTE_ZIPS)}`;
}

function addressOnly(): string {
  return pick(CHARLOTTE_STREETS);
}

function eventWindow(daysOut: number, hour = 14, durationHours = 1) {
  const startAt = daysFromNow(daysOut);
  startAt.setHours(hour, 0, 0, 0);
  const endAt = new Date(startAt);
  endAt.setHours(endAt.getHours() + durationHours);
  return { startAt, endAt };
}

// ─── Contact interaction helpers ──────────────────────────────────────────────

const INTERACTION_TYPES = ['CALL', 'EMAIL', 'MEETING', 'TEXT'];

function makeInteractions(contactId: string, count: number) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const daysBack = rand(1, 90);
    items.push({
      contactId,
      type: pick(INTERACTION_TYPES),
      occurredAt: daysAgo(daysBack),
      subject: pick([
        'Initial outreach', 'Follow-up call', 'Property walkthrough',
        'Market update', 'Offer discussion', 'Contract review',
        'Closing timeline', 'Pre-approval check-in', 'Neighborhood tour',
      ]),
      body: pick([
        'Discussed current market conditions and buyer preferences.',
        'Reviewed comparable sales in the target neighborhood.',
        'Scheduled a showing for next week.',
        'Answered questions about the offer process.',
        'Provided pre-approval documentation checklist.',
        'Toured two properties — client is interested in the second one.',
        'Discussed pricing strategy for upcoming listing.',
        'Confirmed financing is in place, ready to move forward.',
      ]),
    });
  }
  return items;
}

// ─── Task templates ───────────────────────────────────────────────────────────

const ACTIVE_TXN_TASKS = [
  { title: 'Schedule home inspection', priority: 'HIGH', status: 'TODO' },
  { title: 'Review purchase agreement with client', priority: 'URGENT', status: 'IN_PROGRESS' },
  { title: 'Follow up with lender on financing approval', priority: 'HIGH', status: 'TODO' },
  { title: 'Confirm closing date with title company', priority: 'MEDIUM', status: 'TODO' },
  { title: 'Request repair credits from seller', priority: 'HIGH', status: 'TODO' },
  { title: 'Order appraisal', priority: 'URGENT', status: 'IN_PROGRESS' },
  { title: 'Send earnest money wire instructions', priority: 'HIGH', status: 'DONE' },
  { title: 'Coordinate final walkthrough', priority: 'MEDIUM', status: 'TODO' },
];

const PROSPECT_TASKS = [
  { title: 'Schedule initial consultation call', priority: 'HIGH', status: 'TODO' },
  { title: 'Send comparable sales report', priority: 'MEDIUM', status: 'TODO' },
  { title: 'Prepare buyer needs assessment', priority: 'MEDIUM', status: 'TODO' },
  { title: 'Draft listing presentation', priority: 'HIGH', status: 'IN_PROGRESS' },
];

const CLOSED_TASKS = [
  { title: 'Send closing gift', priority: 'LOW', status: 'DONE' },
  { title: 'Request 5-star review', priority: 'MEDIUM', status: 'DONE' },
];

const CONTACT_TASKS = [
  { title: 'Follow-up call', priority: 'MEDIUM', status: 'TODO' },
  { title: 'Send listing alerts', priority: 'LOW', status: 'TODO' },
  { title: 'Schedule buyer consultation', priority: 'HIGH', status: 'TODO' },
  { title: 'Check pre-approval status', priority: 'HIGH', status: 'TODO' },
  { title: 'Send neighborhood market report', priority: 'MEDIUM', status: 'TODO' },
  { title: 'Add to email drip campaign', priority: 'LOW', status: 'DONE' },
];

const EVENT_TEMPLATES = [
  { type: 'HOME_TOUR', title: 'Private showing', durationHours: 1 },
  { type: 'INSPECTION', title: 'Home inspection walkthrough', durationHours: 2 },
  { type: 'APPRAISAL', title: 'Appraisal appointment', durationHours: 1 },
  { type: 'CLOSING', title: 'Closing appointment', durationHours: 2 },
  { type: 'BUYER_CONSULTATION', title: 'Buyer strategy call', durationHours: 1 },
];

// ─── Action queue templates ───────────────────────────────────────────────────

const LEAD_RESPONSE_SUBJECTS = [
  'Following up on your home search',
  'New listings that match your criteria',
  'Ready to take the next step?',
  'Quick question about your home goals',
  'I found some properties you might love',
];

const LEAD_RESPONSE_BODIES = [
  "Hi [Name], I wanted to follow up and see if you have any questions about the Charlotte market. I have a few properties that just came on that I think you'd love.",
  "Hey [Name]! It's been a few weeks since we last connected. The market has been moving fast — I'd love to get you updated on what's available.",
  "Hi [Name], just checking in to see where you are in your home search. I have some new listings in the areas you mentioned that I'd like to share.",
  "Hi [Name], wanted to reach out and see if your timing has changed or if you have any questions I can help answer. Happy to set up a call.",
];

const RISK_TYPES = [
  'inspection_contingency_deadline',
  'financing_contingency_deadline',
  'appraisal_contingency_deadline',
  'earnest_money_due',
  'closing_date_approaching',
];

const RISK_LABELS: Record<string, string> = {
  inspection_contingency_deadline: 'Inspection contingency deadline approaching',
  financing_contingency_deadline: 'Financing contingency deadline approaching',
  appraisal_contingency_deadline: 'Appraisal contingency deadline approaching',
  earnest_money_due: 'Earnest money due date approaching',
  closing_date_approaching: 'Closing date within 7 days',
};

const RELATIONSHIP_ACTIONS = [
  'Send a check-in email',
  'Make a quick phone call',
  'Share a relevant market report',
  'Invite to upcoming open house',
  'Send a neighborhood update',
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  requireDemoSeedOptIn();
  console.log('🌱 Starting Agent HQ seed...');

  // ── Anchor agent ────────────────────────────────────────────────────────────
  const agent = await prisma.user.findFirst({
    where: { email: { in: ['jane.smith@realestategear.com', 'jane.agent@realestategear.com'] } },
    orderBy: { email: 'desc' },
  });
  if (!agent) {
    console.error('❌ Agent user not found. Run `npm run db:demo:reset` or `npm run db:seed:1000` first.');
    process.exit(1);
  }
  console.log(`👤 Found agent: ${agent.email} (${agent.id})`);

  // ── Clear CRM layer ──────────────────────────────────────────────────────────
  // Reuse jane's existing Account (created by `npm run seed`). Deleting it would
  // cascade-delete jane herself via User.accountId onDelete:Cascade, so we clear
  // the CRM children scoped to this account instead.
  const account = await prisma.account.update({
    where: { id: agent.accountId },
    data: { name: 'Jane Smith Real Estate' },
  });
  // AIActions are scoped by userId, not accountId — delete by agent.
  await prisma.aIAction.deleteMany({ where: { userId: agent.id } });
  // Notes authored by jane — delete by authorId.
  await prisma.note.deleteMany({ where: { authorId: agent.id } });
  await prisma.event.deleteMany({ where: { assignedAgentId: agent.id } });
  // CRM data scoped to the account. Children cascade from their parent rows,
  // so deleting transactions and contacts is enough to clear the agent layer.
  await prisma.transaction.deleteMany({ where: { accountId: account.id } });
  await prisma.contact.deleteMany({ where: { accountId: account.id } });
  console.log('🗑️  Cleared existing agent HQ CRM data');

  // Ensure jane is OWNER of her account (idempotent — base seed creates this,
  // but stay defensive if seed-agent is run against a partially-seeded DB).
  const member = await prisma.accountMember.upsert({
    where: { accountId_userId: { accountId: account.id, userId: agent.id } },
    create: { accountId: account.id, userId: agent.id, role: 'OWNER' },
    update: { role: 'OWNER' },
  });
  console.log(`🏢 Reusing account: ${account.name}`);

  // ── Demo MLS access + deployed segments ─────────────────────────────────────
  // Base `db:seed` creates Charlotte listings. Give Jane verified Canopy access
  // and deploy broad segments so Agent HQ's Listing Workbench has real rows.
  await prisma.listing.updateMany({
    where: { source: 'MLS', OR: [{ mlsBoardId: null }, { mlsBoardId: 'canopy_mls' }] },
    data: { mlsBoardId: 'CanopyMLS' },
  });

  await prisma.accountMlsAccess.upsert({
    where: { accountId_mlsBoardId: { accountId: account.id, mlsBoardId: 'CanopyMLS' } },
    create: {
      accountId: account.id,
      mlsBoardId: 'CanopyMLS',
      membershipId: 'JSMITH-DEMO',
      verifiedAt: new Date(),
    },
    update: {
      membershipId: 'JSMITH-DEMO',
      verifiedAt: new Date(),
    },
  });

  const demoPortal = await prisma.portal.upsert({
    where: { slug: 'jane-smith-charlotte-demo' },
    create: {
      accountId: account.id,
      name: 'Jane Smith Charlotte Demo',
      slug: 'jane-smith-charlotte-demo',
      agentDisplayName: 'Jane Smith',
      agentPhone: agent.phoneNumber,
      agentEmail: agent.email,
      brokerageName: 'Real Estate Gear Demo Realty',
      brokeragePhone: '(704) 555-0100',
      isActive: true,
    },
    update: {
      accountId: account.id,
      isActive: true,
      brokerageName: 'Real Estate Gear Demo Realty',
      brokeragePhone: '(704) 555-0100',
    },
  });

  async function upsertDemoCollection(name: string, slug: string, predicate: Record<string, any>) {
    return prisma.listingCollection.upsert({ where: { portalId_slug: { portalId: demoPortal.id, slug } }, create: { portalId: demoPortal.id, slug, name, predicate }, update: { name, predicate } });
  }

  await upsertDemoCollection('Charlotte Active Listings', 'charlotte-active', {});
  await upsertDemoCollection('Dilworth and South End', 'dilworth-south-end', {});
  // Was upsertDemoSegment(...) with the pre-collections segment shape, which no
  // longer exists. collectionPredicateSchema is strict and has no city field —
  // geography is expressed through areaSlugs or classification tags, and this
  // seed creates neither. Every seeded property is Charlotte metro anyway, so
  // the price floor is what actually distinguishes this collection.
  await upsertDemoCollection('Luxury Charlotte Homes', 'luxury-charlotte', {
    price: { min: 1_000_000, nulls: 'exclude' },
  });

  console.log('🏘️  Enabled demo MLS access and deployed listing collections');

  // ── Build name pairs ─────────────────────────────────────────────────────────
  // Generate 250 unique first+last combos
  const namePairs: { firstName: string; lastName: string }[] = [];
  const usedPairs = new Set<string>();
  while (namePairs.length < 250) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const key = `${firstName}${lastName}`;
    if (!usedPairs.has(key)) {
      usedPairs.add(key);
      namePairs.push({ firstName, lastName });
    }
  }

  // ── Create contacts ──────────────────────────────────────────────────────────
  //   0–149   → LEAD  (NEW 0–59, CONTACTED 60–109, QUALIFIED 110–149)
  //   150–229 → CLIENT (ACTIVE 150–199, CLOSED 200–229)
  //   230–249 → VENDOR (ACTIVE)

  const contacts: { id: string; firstName: string; lastName: string; type: string; stage: string }[] = [];

  for (let i = 0; i < 250; i++) {
    const { firstName, lastName } = namePairs[i];
    const email = uniqueEmail(firstName, lastName);

    let type: string;
    let stage: string;
    let side: string;

    if (i < 60) {
      type = 'LEAD'; stage = 'NEW'; side = rand(0, 1) === 0 ? 'BUYER' : 'SELLER';
    } else if (i < 110) {
      type = 'LEAD'; stage = 'CONTACTED'; side = rand(0, 1) === 0 ? 'BUYER' : 'SELLER';
    } else if (i < 150) {
      type = 'LEAD'; stage = 'QUALIFIED'; side = rand(0, 1) === 0 ? 'BUYER' : 'SELLER';
    } else if (i < 200) {
      type = 'CLIENT'; stage = 'ACTIVE'; side = rand(0, 1) === 0 ? 'BUYER' : 'SELLER';
    } else if (i < 230) {
      type = 'CLIENT'; stage = 'CLOSED'; side = rand(0, 1) === 0 ? 'BUYER' : 'SELLER';
    } else {
      type = 'VENDOR'; stage = 'ACTIVE'; side = 'SELLER';
    }

    const trackStage =
      stage === 'CLOSED' ? 'CLOSED' :
      stage === 'ACTIVE' ? 'ACTIVE' :
      stage === 'QUALIFIED' ? 'SEARCHING' :
      stage === 'CONTACTED' ? 'INITIAL' : 'NEW';

    const contact = await prisma.contact.create({
      data: {
        accountId: account.id,
        firstName,
        lastName,
        email,
        normalizedEmail: email.trim().toLowerCase(),
        phone: phone(),
        type,
        stage,
        source: pick(SOURCES),
        assignedMemberId: member.id,
        tracks: {
          create: [{ side, stage: trackStage }],
        },
      },
    });

    // interactions: VENDOR/CLOSED get fewer; NEW gets 0–1
    const interactionCount =
      type === 'VENDOR' ? rand(0, 2) :
      stage === 'NEW' ? rand(0, 1) :
      stage === 'CONTACTED' ? rand(1, 2) :
      stage === 'QUALIFIED' || stage === 'ACTIVE' ? rand(1, 3) :
      stage === 'CLOSED' ? rand(0, 2) : 0;

    let lastInteractionAt: Date | null = null;
    if (interactionCount > 0) {
      const interactions = makeInteractions(contact.id, interactionCount);
      await prisma.contactInteraction.createMany({ data: interactions });
      lastInteractionAt = interactions.reduce((latest, item) =>
        item.occurredAt > latest ? item.occurredAt : latest,
        interactions[0].occurredAt,
      );
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastInteractionAt },
      });
    }

    contacts.push({ id: contact.id, firstName, lastName, type, stage });
  }

  console.log(`👥 Created 250 contacts (150 leads, 80 clients, 20 vendors)`);

  // ── Create transactions ──────────────────────────────────────────────────────
  // 5 PROSPECT (lead): 3 BUY + 2 SELL
  // 10 active:  5 PENDING BUY + 3 PENDING SELL + 2 SIGNED BUY
  // 30 closed:  15 BUY CLOSED + 15 SELL CLOSED

  type TxnSpec = { type: string; stage: string; count: number };
  const txnSpecs: TxnSpec[] = [
    { type: 'BUY', stage: 'PROSPECT', count: 3 },
    { type: 'SELL', stage: 'PROSPECT', count: 2 },
    { type: 'BUY', stage: 'PENDING', count: 5 },
    { type: 'SELL', stage: 'PENDING', count: 3 },
    { type: 'BUY', stage: 'SIGNED', count: 2 },
    { type: 'BUY', stage: 'CLOSED', count: 15 },
    { type: 'SELL', stage: 'CLOSED', count: 15 },
  ];

  const activeTransactions: { id: string; address: string; stage: string; type: string; contactId: string }[] = [];
  let txnIdx = 0;
  let totalTaskCount = 0;

  // Pool of active/qualified clients/leads to use as transaction parties
  const buyerPool = contacts.filter(c => c.stage !== 'CLOSED' && c.type !== 'VENDOR').slice(0, 80);
  const sellerPool = contacts.filter(c => c.stage !== 'CLOSED' && c.type !== 'VENDOR').slice(80, 160);
  let buyerIdx = 0;
  let sellerIdx = 0;
  const listingPool = await prisma.listing.findMany({
    where: { mlsBoardId: 'CanopyMLS' },
    include: { property: true },
    orderBy: [{ status: 'asc' }, { listDate: 'desc' }],
    take: 120,
  });

  for (const spec of txnSpecs) {
    for (let n = 0; n < spec.count; n++) {
      const listing = listingPool[txnIdx % Math.max(listingPool.length, 1)];
      const address = listing?.property
        ? `${listing.property.address}, ${listing.property.city}, ${listing.property.state} ${listing.property.zipCode}`
        : addressOnly();
      const listPrice = listing?.listPrice != null ? Number(listing.listPrice) : roundToThousand(rand(300, 1900) * 1000);
      const salePrice = spec.stage === 'CLOSED'
        ? roundToThousand(listPrice * (rand(95, 103) / 100))
        : undefined;

      let closingDate: Date | undefined;
      if (spec.stage === 'CLOSED') {
        closingDate = daysAgo(rand(30, 365));
      } else if (spec.stage === 'PENDING') {
        closingDate = daysFromNow(rand(15, 45));
      } else if (spec.stage === 'SIGNED') {
        closingDate = daysFromNow(rand(30, 60));
      }

      // Contingency dates for pending transactions (used in action queue)
      const inspectionContingencyDate = spec.stage === 'PENDING'
        ? daysFromNow(rand(2, 10))
        : undefined;
      const financingContingencyDate = spec.stage === 'PENDING'
        ? daysFromNow(rand(5, 21))
        : undefined;

      const txn = await prisma.transaction.create({
        data: {
          accountId: account.id,
          type: spec.type,
          stage: spec.stage,
          address,
          propertyId: listing?.propertyId ?? null,
          mlsId: listing?.mlsId ?? null,
          listPrice,
          salePrice: salePrice ?? null,
          closingDate: closingDate ?? null,
          inspectionContingencyDate: inspectionContingencyDate ?? null,
          financingContingencyDate: financingContingencyDate ?? null,
          assignedAgentId: agent.id,
        },
      });

      // Attach a party
      const partyContact = spec.type === 'BUY'
        ? buyerPool[buyerIdx++ % buyerPool.length]
        : sellerPool[sellerIdx++ % sellerPool.length];

      await prisma.transactionParty.create({
        data: {
          transactionId: txn.id,
          contactId: partyContact.id,
          role: spec.type === 'BUY' ? 'BUYER' : 'SELLER',
        },
      });

      // Tasks
      let taskTemplates: typeof ACTIVE_TXN_TASKS;
      if (spec.stage === 'PENDING' || spec.stage === 'SIGNED') {
        taskTemplates = ACTIVE_TXN_TASKS.slice(0, rand(3, 4));
      } else if (spec.stage === 'PROSPECT') {
        taskTemplates = PROSPECT_TASKS.slice(0, rand(1, 2));
      } else {
        taskTemplates = CLOSED_TASKS;
      }

      for (const t of taskTemplates) {
        const dueDate = t.status === 'DONE'
          ? daysAgo(rand(5, 60))
          : daysFromNow(rand(1, 21));
        await prisma.task.create({
          data: {
            accountId: account.id,
            title: t.title,
            priority: t.priority,
            status: t.status,
            dueDate,
            assignedToId: agent.id,
            transactionId: txn.id,
          },
        });
        totalTaskCount++;
      }

      if (spec.stage !== 'CLOSED') {
        activeTransactions.push({ id: txn.id, address, stage: spec.stage, type: spec.type, contactId: partyContact.id });
      }

      txnIdx++;
    }
  }

  console.log(`🏡 Created 45 transactions`);

  // ── Calendar events ──────────────────────────────────────────────────────────
  let eventCount = 0;
  for (const txn of activeTransactions.slice(0, 12)) {
    const template = pick(EVENT_TEMPLATES);
    const { startAt, endAt } = eventWindow(rand(1, 21), rand(9, 16), template.durationHours);
    const event = await prisma.event.create({
      data: {
        type: template.type,
        title: `${template.title} — ${txn.address}`,
        description: `${txn.stage} ${txn.type} transaction calendar event.`,
        location: txn.address,
        startAt,
        endAt,
        timezone: 'America/New_York',
        assignedAgentId: agent.id,
        transactionId: txn.id,
      },
    });
    await prisma.eventAttendee.create({
      data: {
        eventId: event.id,
        contactId: txn.contactId,
        role: txn.type === 'BUY' ? 'BUYER' : 'SELLER',
        rsvpStatus: 'NEEDS_ACTION',
      },
    });
    eventCount++;
  }

  const consultationContacts = contacts.filter(c => c.stage === 'QUALIFIED' || c.stage === 'ACTIVE').slice(0, 10);
  for (const c of consultationContacts) {
    const { startAt, endAt } = eventWindow(rand(2, 28), rand(10, 16), 1);
    const event = await prisma.event.create({
      data: {
        type: 'BUYER_CONSULTATION',
        title: `Strategy call with ${c.firstName} ${c.lastName}`,
        description: 'Review goals, timeline, financing, and target communities.',
        location: 'Phone call',
        startAt,
        endAt,
        timezone: 'America/New_York',
        assignedAgentId: agent.id,
      },
    });
    await prisma.eventAttendee.create({
      data: { eventId: event.id, contactId: c.id, role: 'CLIENT', rsvpStatus: 'ACCEPTED' },
    });
    eventCount++;
  }

  console.log(`📅 Created ${eventCount} calendar events`);

  // ── Standalone contact tasks (~30) ───────────────────────────────────────────
  const taskContacts = contacts.filter(c => c.stage === 'QUALIFIED' || c.stage === 'ACTIVE').slice(0, 30);
  for (const c of taskContacts) {
    const t = pick(CONTACT_TASKS);
    await prisma.task.create({
      data: {
        accountId: account.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        dueDate: t.status === 'DONE' ? daysAgo(rand(1, 30)) : daysFromNow(rand(1, 14)),
        assignedToId: agent.id,
        contactId: c.id,
      },
    });
    totalTaskCount++;
  }

  console.log(`✅ Created ${totalTaskCount} tasks`);

  // ── Action queue ─────────────────────────────────────────────────────────────
  let actionQueueCount = 0;

  // 1. LEAD_RESPONSE — 10 items for NEW/CONTACTED leads
  const leadResponseContacts = contacts
    .filter(c => c.stage === 'NEW' || c.stage === 'CONTACTED')
    .slice(0, 10);

  for (const c of leadResponseContacts) {
    const subject = pick(LEAD_RESPONSE_SUBJECTS);
    const body = pick(LEAD_RESPONSE_BODIES).replace('[Name]', c.firstName);
    const daysSinceContact = rand(14, 30);
    await prisma.aIAction.create({
      data: {
        userId: agent.id,
        toolName: 'lead_response',
        toolType: 'LEAD_RESPONSE',
        label: `Draft follow-up email for ${c.firstName} ${c.lastName}`,
        reason: `No contact in ${daysSinceContact} days — lead may go cold`,
        priority: rand(1, 3),
        contactId: c.id,
        contextType: 'contact',
        contextEntityId: c.id,
        status: 'PENDING',
        requiresConfirmation: true,
        payload: {
          contactId: c.id,
          contactName: `${c.firstName} ${c.lastName}`,
          suggestedSubject: subject,
          suggestedBody: body,
        },
        previewData: {
          leadSummary: `${c.firstName} ${c.lastName} is an active lead who has not been contacted in ${daysSinceContact} days. Re-engagement now will help prevent this lead from going cold.`,
          qualificationSignals: ['Has expressed interest in Charlotte market', 'Prequalification not yet confirmed'],
          recommendedStrategy: 'Send a personalized follow-up email to re-engage and gauge current interest level.',
          emailSubject: subject,
          emailBody: body,
          suggestedTags: [],
          suggestedStage: null,
          followUpTask: {
            title: `Follow-up call with ${c.firstName} ${c.lastName}`,
            description: 'Check in after email to gauge interest.',
            dueInDays: 3,
            priority: 'MEDIUM',
          },
          missingInfo: ['Pre-approval status', 'Target move-in timeline'],
          riskFlags: [],
        },
      },
    });
    actionQueueCount++;
  }

  // 2. TRANSACTION_RISK — 10 items for PENDING transactions
  const pendingTxns = activeTransactions.filter(t => t.stage === 'PENDING').slice(0, 10);
  for (const txn of pendingTxns) {
    const riskType = pick(RISK_TYPES);
    const daysUntil = rand(2, 7);
    await prisma.aIAction.create({
      data: {
        userId: agent.id,
        toolName: 'transaction_risk',
        toolType: 'TRANSACTION_RISK',
        label: `${RISK_LABELS[riskType]} — ${txn.address}`,
        reason: `${daysUntil} days until deadline on ${txn.type} transaction`,
        priority: daysUntil <= 3 ? 5 : rand(2, 4),
        transactionId: txn.id,
        contextType: 'transaction',
        contextEntityId: txn.id,
        status: 'PENDING',
        requiresConfirmation: true,
        payload: {
          transactionId: txn.id,
          address: txn.address,
          riskType,
          daysUntilDeadline: daysUntil,
          transactionType: txn.type,
        },
        previewData: {
          riskFactors: [{
            rule: riskType,
            ruleLabel: RISK_LABELS[riskType],
            description: `${daysUntil} day${daysUntil !== 1 ? 's' : ''} remaining — action required immediately.`,
            severity: daysUntil <= 3 ? 'HIGH' : 'MEDIUM',
            item: null,
          }],
          overallSeverity: daysUntil <= 3 ? 'HIGH' : 'MEDIUM',
          summary: `${RISK_LABELS[riskType]} for ${txn.address}. Only ${daysUntil} day${daysUntil !== 1 ? 's' : ''} remain on this ${txn.type} transaction.`,
          recommendedNextStep: 'Contact all parties involved to confirm deadline awareness and take corrective action if needed.',
          suggestedTaskTitle: `Resolve: ${RISK_LABELS[riskType]} — ${txn.address}`,
          closingDateFormatted: null,
          transactionAddress: txn.address,
        },
      },
    });
    actionQueueCount++;
  }

  // 3. RELATIONSHIP_MEMORY — 10 items for ACTIVE/QUALIFIED contacts
  const dormantContacts = contacts
    .filter(c => c.stage === 'QUALIFIED' || c.stage === 'ACTIVE')
    .slice(0, 10);

  for (const c of dormantContacts) {
    const daysSince = rand(35, 75);
    const suggestedAction = pick(RELATIONSHIP_ACTIONS);
    const lastAt = daysAgo(daysSince);
    await prisma.aIAction.create({
      data: {
        userId: agent.id,
        toolName: 'relationship_memory',
        toolType: 'RELATIONSHIP_MEMORY',
        label: `Reach out to ${c.firstName} ${c.lastName} — ${daysSince} days since last contact`,
        reason: `No interaction recorded in ${daysSince} days`,
        priority: rand(0, 2),
        contactId: c.id,
        contextType: 'contact',
        contextEntityId: c.id,
        status: 'PENDING',
        requiresConfirmation: true,
        payload: {
          contactId: c.id,
          contactName: `${c.firstName} ${c.lastName}`,
          lastInteractionAt: lastAt.toISOString(),
          daysSinceLastContact: daysSince,
          suggestedAction,
        },
        previewData: {
          rule: 'dormant_contact',
          ruleLabel: 'Dormant Contact',
          summary: `No interaction with ${c.firstName} ${c.lastName} recorded in the past ${daysSince} days. This relationship is at risk of going cold.`,
          lastInteractionAt: lastAt.toISOString(),
          recommendedAction: suggestedAction,
          suggestedTaskTitle: `Follow up with ${c.firstName} ${c.lastName}`,
          urgency: daysSince > 60 ? 'high' : daysSince > 45 ? 'medium' : 'low',
        },
      },
    });
    actionQueueCount++;
  }

  console.log(`🤖 Created ${actionQueueCount} action queue items`);

  // ── Done ──────────────────────────────────────────────────────────────────────
  console.log('\n✅ Agent HQ seed completed!');
  console.log('\n📋 Summary:');
  console.log('   👥 250 contacts (150 leads, 80 clients, 20 vendors)');
  console.log('   🏡 45 transactions (5 prospect, 10 active, 30 closed)');
  console.log(`   📅 ${eventCount} calendar events`);
  console.log(`   ✅ ${totalTaskCount} tasks across transactions and contacts`);
  console.log(`   🤖 ${actionQueueCount} action queue items (PENDING)`);
  console.log('\n🔑 Agent login:');
  console.log(`   ${agent.email} / agent123`);
}

main()
  .catch(e => {
    console.error('❌ Agent HQ seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
