import { Prisma, prisma } from 'db';
import { tryLinkContactToUser } from './portalBridgeService.js';
import { upsertDocument, deleteDocument, toContactDoc } from '../search/index.js';
import { refresh as refreshContactDenorm } from './contactActivityDenormService.js';
import { buildLifecycleClause } from './lifecycleClause.js';

async function resolveMember(userId: string) {
  const member = await prisma.accountMember.findFirst({ where: { userId } });
  return member ?? null;
}

const TRACK_SIDES = new Set(['BUYER', 'SELLER']);
const EVENT_INTERACTION_TYPES = ['MEETING', 'TOUR'];
const CONSULT_INTERACTION_TYPE = 'CONSULT';

function parseBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function parseInteger(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeTags(tags) {
  if (tags == null) return undefined;

  const values = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeTracks(tracks) {
  if (tracks == null) return undefined;
  if (!Array.isArray(tracks)) return [];

  const bySide = new Map();

  for (const track of tracks) {
    const side = String(track?.side ?? '').trim().toUpperCase();
    if (!TRACK_SIDES.has(side)) continue;

    const stage = String(track?.stage ?? '').trim();
    bySide.set(side, {
      side,
      stage,
      isActive: track?.isActive !== false && Boolean(stage),
    });
  }

  return Array.from(bySide.values());
}

function buildSearchClause(search): Prisma.ContactWhereInput | null {
  if (!search) return null;

  return {
    OR: [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ],
  } as Prisma.ContactWhereInput;
}

function buildTrackClause(side, stage, hasTrack) {
  const trackFilter: Prisma.ContactTrackWhereInput = { side, isActive: true };
  if (stage) trackFilter.stage = stage;

  const parsedHasTrack = parseBoolean(hasTrack);
  if (parsedHasTrack === true || stage) {
    return { tracks: { some: trackFilter } };
  }

  if (parsedHasTrack === false) {
    return { tracks: { none: { side, isActive: true } } };
  }

  return null;
}

function buildEventClause(eventFilter) {
  if (!eventFilter || eventFilter === 'ALL') return null;

  const now = new Date();
  const types = { in: EVENT_INTERACTION_TYPES };

  switch (eventFilter) {
    case 'UPCOMING_OR_RECENT': {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      return { interactions: { some: { type: types, occurredAt: { gte: cutoff } } } };
    }
    case 'UPCOMING_ONLY':
      return { interactions: { some: { type: types, occurredAt: { gt: now } } } };
    case 'NO_COMPLETED':
      return { interactions: { none: { type: types, occurredAt: { lte: now } } } };
    case 'LAST_3':
    case 'LAST_7':
    case 'LAST_14':
    case 'LAST_21':
    case 'LAST_30': {
      const days = parseInteger(eventFilter.split('_')[1], 30);
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      return { interactions: { some: { type: types, occurredAt: { gte: cutoff, lte: now } } } };
    }
    default:
      return null;
  }
}

function buildConsultClause(consultFilter) {
  if (!consultFilter || consultFilter === 'ALL') return null;

  const now = new Date();

  switch (consultFilter) {
    case 'UPCOMING_OR_RECENT': {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      return { interactions: { some: { type: CONSULT_INTERACTION_TYPE, occurredAt: { gte: cutoff } } } };
    }
    case 'UPCOMING_ONLY':
      return { interactions: { some: { type: CONSULT_INTERACTION_TYPE, occurredAt: { gt: now } } } };
    case 'LAST_30':
    case 'LAST_90':
    case 'LAST_180': {
      const days = parseInteger(consultFilter.split('_')[1], 30);
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      return {
        interactions: {
          some: {
            type: CONSULT_INTERACTION_TYPE,
            occurredAt: { gte: cutoff, lte: now },
          },
        },
      };
    }
    case 'COMPLETED':
      return {
        interactions: {
          some: {
            type: CONSULT_INTERACTION_TYPE,
            occurredAt: { lte: now },
          },
        },
      };
    default:
      return null;
  }
}

function decorateContact(contact) {
  const buyerTrack = contact.tracks.find((track) => track.side === 'BUYER' && track.isActive) ?? null;
  const sellerTrack = contact.tracks.find((track) => track.side === 'SELLER' && track.isActive) ?? null;
  const lastContact = contact.interactions[0] ?? null;
  const lastConsult = contact.interactions.find((interaction) => interaction.type === CONSULT_INTERACTION_TYPE) ?? null;
  const lastEvent = contact.interactions.find((interaction) => EVENT_INTERACTION_TYPES.includes(interaction.type)) ?? null;

  return {
    ...contact,
    buyerTrack,
    sellerTrack,
    lastContactAt: lastContact?.occurredAt ?? null,
    lastConsultAt: lastConsult?.occurredAt ?? null,
    lastEventAt: lastEvent?.occurredAt ?? null,
    tracks: undefined,
    interactions: undefined,
  };
}

async function syncContactTracks(tx, contactId, tracks) {
  const normalizedTracks = normalizeTracks(tracks);
  if (normalizedTracks === undefined) return;

  const providedSides = new Set(normalizedTracks.map((track) => track.side));

  for (const side of TRACK_SIDES) {
    if (!providedSides.has(side)) continue;

    const incomingTrack = normalizedTracks.find((track) => track.side === side);
    const stage = incomingTrack?.stage ?? '';
    const currentActiveTrack = await tx.contactTrack.findFirst({
      where: { contactId, side, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!stage) {
      await tx.contactTrack.updateMany({
        where: { contactId, side, isActive: true },
        data: { isActive: false },
      });
      continue;
    }

    if (currentActiveTrack?.stage === stage) {
      continue;
    }

    await tx.contactTrack.updateMany({
      where: { contactId, side, isActive: true },
      data: { isActive: false },
    });

    await tx.contactTrack.create({
      data: {
        contactId,
        side,
        stage,
        isActive: true,
      },
    });
  }
}

export async function getContacts(agentId, filters: Record<string, any> = {}) {
  const {
    page = 1,
    limit = 20,
    type,
    stage,
    lifecycle,
    search,
    sortBy = 'created_desc',
    tags,
    buyerStage,
    sellerStage,
    hasBuyerTrack,
    hasSellerTrack,
    eventFilter,
    consultFilter,
  } = filters;

  const skip = (parseInteger(page, 1) - 1) * parseInteger(limit, 20);
  const take = parseInteger(limit, 20);

  const member = await resolveMember(agentId);
  if (!member) return { contacts: [], pagination: { page: parseInteger(page, 1), limit: parseInteger(limit, 20), total: 0, totalPages: 0 }, lifecycleCounts: { prospect: 0, activeLead: 0, client: 0, vendor: 0 } };

  const where: Prisma.ContactWhereInput = { accountId: member.accountId };
  const andClauses: Prisma.ContactWhereInput[] = [];

  if (lifecycle) {
    andClauses.push(buildLifecycleClause(lifecycle));
  } else if (type) {
    andClauses.push({ type });
  }
  if (stage) andClauses.push({ stage });

  const normalizedTags = normalizeTags(tags);
  if (normalizedTags?.length) {
    andClauses.push({ tags: { array_contains: normalizedTags } });
  }

  const searchClause = buildSearchClause(search);
  if (searchClause) andClauses.push(searchClause);

  const buyerTrackClause = buildTrackClause('BUYER', buyerStage, hasBuyerTrack);
  if (buyerTrackClause) andClauses.push(buyerTrackClause);

  const sellerTrackClause = buildTrackClause('SELLER', sellerStage, hasSellerTrack);
  if (sellerTrackClause) andClauses.push(sellerTrackClause);

  const eventClause = buildEventClause(eventFilter);
  if (eventClause) andClauses.push(eventClause);

  const consultClause = buildConsultClause(consultFilter);
  if (consultClause) andClauses.push(consultClause);

  if (andClauses.length) {
    where.AND = andClauses;
  }

  let orderBy;
  switch (sortBy) {
    case 'name_asc':
      orderBy = [{ lastName: 'asc' }, { firstName: 'asc' }];
      break;
    case 'name_desc':
      orderBy = [{ lastName: 'desc' }, { firstName: 'desc' }];
      break;
    case 'created_asc':
      orderBy = { createdAt: 'asc' };
      break;
    default:
      orderBy = { createdAt: 'desc' };
  }

  const baseWhere = { accountId: member.accountId };

  const [contacts, total, prospectCount, activeLeadCount, clientCount, vendorCount] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        tracks: {
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
        },
        interactions: {
          orderBy: { occurredAt: 'desc' },
          take: 50,
        },
        _count: { select: { interactions: true, transactionParties: true, tasks: true } },
      },
    }),
    prisma.contact.count({ where }),
    prisma.contact.count({ where: { ...baseWhere, ...buildLifecycleClause('prospect') } }),
    prisma.contact.count({ where: { ...baseWhere, ...buildLifecycleClause('active-lead') } }),
    prisma.contact.count({ where: { ...baseWhere, ...buildLifecycleClause('client') } }),
    prisma.contact.count({ where: { ...baseWhere, ...buildLifecycleClause('vendor') } }),
  ]);

  return {
    contacts: contacts.map(decorateContact),
    pagination: {
      page: parseInteger(page, 1),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
    lifecycleCounts: {
      prospect: prospectCount,
      activeLead: activeLeadCount,
      client: clientCount,
      vendor: vendorCount,
    },
  };
}

export async function getContactById(id, agentId) {
  const member = await resolveMember(agentId);
  if (!member) return null;
  return prisma.contact.findFirst({
    where: { id, accountId: member.accountId },
    include: {
      user: {
        select: {
          id: true, email: true, firstName: true, lastName: true,
          _count: { select: { favorites: true, inquiries: true, savedSearches: true } },
        },
      },
      tracks: {
        where: { isActive: true },
        orderBy: [{ side: 'asc' }, { updatedAt: 'desc' }],
      },
      interactions: { orderBy: { occurredAt: 'desc' }, take: 50 },
      transactionParties: {
        include: {
          transaction: {
            select: { id: true, type: true, stage: true, address: true, listPrice: true },
          },
        },
      },
      tasks: {
        where: { status: { not: 'DONE' } },
        orderBy: { dueDate: 'asc' },
        take: 20,
      },
      notes: { orderBy: { createdAt: 'desc' }, take: 10 },
      eventAttendees: {
        include: {
          event: {
            select: {
              id: true,
              title: true,
              type: true,
              customType: true,
              description: true,
              status: true,
              startAt: true,
              endAt: true,
              isAllDay: true,
              location: true,
              transactionId: true,
            },
          },
        },
        orderBy: {
          event: { startAt: 'asc' },
        },
      },
    },
  });
}

export async function createContact(agentId, data) {
  const member = await resolveMember(agentId);
  if (!member) return null;

  const tags = normalizeTags(data.tags);
  const tracks = normalizeTracks(data.tracks);

  const contact = await prisma.$transaction(async (tx) => {
    const createdContact = await tx.contact.create({
      data: {
        ...data,
        normalizedEmail: data.email?.trim().toLowerCase() || null,
        tags,
        tracks: undefined,
        accountId: member.accountId,
        assignedMemberId: member.id,
      },
    });

    await syncContactTracks(tx, createdContact.id, tracks);
    return createdContact;
  });

  tryLinkContactToUser(contact.id);
  upsertDocument('contacts', toContactDoc(contact));
  return contact;
}

export async function updateContact(id, agentId, data) {
  const member = await resolveMember(agentId);
  if (!member) return null;
  const contact = await prisma.contact.findFirst({ where: { id, accountId: member.accountId } });
  if (!contact) return null;

  const tags = normalizeTags(data.tags);
  const tracks = normalizeTracks(data.tracks);

  await prisma.$transaction(async (tx) => {
    const contactData = { ...data };
    if ('email' in data) contactData.normalizedEmail = data.email?.trim().toLowerCase() || null;
    delete contactData.tracks;

    await tx.contact.update({
      where: { id },
      data: {
        ...contactData,
        ...(tags !== undefined ? { tags } : {}),
      },
    });

    await syncContactTracks(tx, id, tracks);
  });

  const updated = await getContactById(id, agentId);
  if (updated) upsertDocument('contacts', toContactDoc(updated));
  return updated;
}

export async function deleteContact(id, agentId) {
  const member = await resolveMember(agentId);
  if (!member) return false;
  const contact = await prisma.contact.findFirst({ where: { id, accountId: member.accountId } });
  if (!contact) return false;

  await prisma.contact.delete({ where: { id } });
  deleteDocument('contacts', id);
  return true;
}

export async function addInteraction(contactId, agentId, data) {
  const member = await resolveMember(agentId);
  if (!member) return null;
  const contact = await prisma.contact.findFirst({ where: { id: contactId, accountId: member.accountId } });
  if (!contact) return null;

  const interaction = await prisma.contactInteraction.create({
    data: {
      ...data,
      side: data.side || null,
      contactId,
    },
  });
  refreshContactDenorm(contactId).catch(() => {});
  return interaction;
}

export async function getInteractions(contactId, agentId) {
  const member = await resolveMember(agentId);
  if (!member) return null;
  const contact = await prisma.contact.findFirst({ where: { id: contactId, accountId: member.accountId } });
  if (!contact) return null;

  return prisma.contactInteraction.findMany({
    where: { contactId },
    orderBy: { occurredAt: 'desc' },
  });
}

export async function updateInteraction(contactId, interactionId, agentId, data) {
  const member = await resolveMember(agentId);
  if (!member) return null;
  const contact = await prisma.contact.findFirst({ where: { id: contactId, accountId: member.accountId } });
  if (!contact) return null;

  const interaction = await prisma.contactInteraction.findFirst({
    where: { id: interactionId, contactId },
  });
  if (!interaction) return null;

  return prisma.contactInteraction.update({
    where: { id: interactionId },
    data: {
      ...data,
      side: data.side || null,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : undefined,
      duration: data.duration !== undefined ? (data.duration ? parseInt(data.duration, 10) : null) : undefined,
    },
  });
}

export async function deleteInteraction(contactId, interactionId, agentId) {
  const member = await resolveMember(agentId);
  if (!member) return false;
  const contact = await prisma.contact.findFirst({ where: { id: contactId, accountId: member.accountId } });
  if (!contact) return false;

  const interaction = await prisma.contactInteraction.findFirst({
    where: { id: interactionId, contactId },
  });
  if (!interaction) return false;

  await prisma.contactInteraction.delete({ where: { id: interactionId } });
  return true;
}
