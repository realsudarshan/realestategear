import { Prisma, prisma, type EventStatus, type EventType } from 'db';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from './googleWorkspaceService.js';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  HOME_TOUR: 'Home tour',
  BUYER_CONSULTATION: 'Buyer consultation',
  LISTING_CONSULTATION: 'Listing consultation',
  MEETING: 'Meeting',
  INSPECTION: 'Inspection',
  WALKTHROUGH: 'Walkthrough',
  CLOSING: 'Closing',
  APPRAISAL: 'Appraisal',
  OTHER: 'Other event',
};

const EVENT_STATUSES = new Set<EventStatus>(['SCHEDULED', 'COMPLETED', 'CANCELLED']);

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeEventType(value): EventType {
  const type = String(value || 'OTHER').trim().toUpperCase() as EventType;
  if (Object.prototype.hasOwnProperty.call(EVENT_TYPE_LABELS, type)) return type;
  throw badRequest('type must be a valid event type.');
}

function normalizeEventStatus(value): EventStatus {
  const status = String(value || 'SCHEDULED').trim().toUpperCase() as EventStatus;
  if (EVENT_STATUSES.has(status)) return status;
  throw badRequest('status must be SCHEDULED, COMPLETED, or CANCELLED.');
}

function eventTitle(type: EventType, customType: string | null = null) {
  if (type === 'OTHER' && customType) return customType;
  return EVENT_TYPE_LABELS[type] || EVENT_TYPE_LABELS.OTHER;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeAttendeeInput(attendees) {
  if (!Array.isArray(attendees)) return [];
  return attendees
    .map((attendee) => ({
      contactId: String(attendee?.contactId ?? '').trim(),
      role: attendee?.role ? String(attendee.role).trim() : null,
    }))
    .filter((attendee) => attendee.contactId);
}

function toDate(value, fallback = null) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function isoDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function buildGoogleEventPayload(event) {
  const payload: Record<string, any> = {
    summary: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
    attendees: (event.attendees || [])
      .map((attendee) => {
        if (!attendee.contact?.email) return null;
        return {
          email: attendee.contact.email,
          displayName: `${attendee.contact.firstName} ${attendee.contact.lastName}`.trim() || undefined,
        };
      })
      .filter(Boolean),
    extendedProperties: {
      private: {
        realestategearEventId: event.id,
      },
    },
  };

  if (event.isAllDay) {
    payload.start = { date: isoDay(event.startAt) };
    payload.end = { date: isoDay(event.endAt) };
  } else {
    payload.start = {
      dateTime: new Date(event.startAt).toISOString(),
      ...(event.timezone ? { timeZone: event.timezone } : {}),
    };
    payload.end = {
      dateTime: new Date(event.endAt).toISOString(),
      ...(event.timezone ? { timeZone: event.timezone } : {}),
    };
  }

  return payload;
}

async function ensureAgentContacts(agentId, attendees) {
  const contactIds = [...new Set(attendees.map((attendee) => attendee.contactId))] as string[];
  if (!contactIds.length) return [];

  const member = await prisma.accountMember.findFirst({ where: { userId: agentId } });
  if (!member) {
    const error = new Error('Agent account not found.');
    error.status = 400;
    throw error;
  }

  const contacts = await prisma.contact.findMany({
    where: {
      id: { in: contactIds },
      accountId: member.accountId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (contacts.length !== contactIds.length) {
    const error = new Error('One or more attendees were not found for this agent.');
    error.status = 400;
    throw error;
  }

  return contacts;
}

async function getEventForSync(eventId, agentId) {
  return prisma.event.findFirst({
    where: { id: eventId, assignedAgentId: agentId },
    include: {
      attendees: {
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });
}

async function syncEventToGoogle(event, agentId) {
  const payload = buildGoogleEventPayload(event);
  if (event.providerEventId) {
    const updated = await updateCalendarEvent(agentId, event.providerEventId, payload);
    return {
      providerCalendarId: updated.organizer?.email ? 'primary' : event.providerCalendarId || 'primary',
      providerEventId: updated.id || event.providerEventId,
      providerSyncError: null,
      lastSyncedAt: new Date(),
    };
  }

  const created = await createCalendarEvent(agentId, payload);
  return {
    providerCalendarId: 'primary',
    providerEventId: created.id || null,
    providerSyncError: null,
    lastSyncedAt: new Date(),
  };
}

function isExpectedGoogleUnavailable(error) {
  return /google account not connected/i.test(error?.message ?? '');
}

export async function getEvents(agentId, filters: Record<string, any> = {}) {
  const page = parseInteger(filters.page, 1);
  const limit = parseInteger(filters.limit, 20);
  const skip = (page - 1) * limit;
  const where: Prisma.EventWhereInput = { assignedAgentId: agentId };

  if (filters.type) where.type = normalizeEventType(filters.type);
  if (filters.status) where.status = normalizeEventStatus(filters.status);
  if (filters.transactionId) where.transactionId = String(filters.transactionId);
  if (filters.contactId) {
    where.attendees = { some: { contactId: String(filters.contactId) } };
  }
  if (filters.from || filters.to) {
    where.startAt = {};
    if (filters.from) where.startAt.gte = toDate(filters.from);
    if (filters.to) where.startAt.lte = toDate(filters.to);
  }

  const orderBy: Prisma.EventOrderByWithRelationInput[] =
    filters.sortBy === 'start_desc'
      ? [{ startAt: 'desc' }, { createdAt: 'desc' }]
      : [{ startAt: 'asc' }, { createdAt: 'desc' }];

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        attendees: {
          include: {
            contact: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        transaction: {
          select: { id: true, address: true, stage: true, type: true },
        },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getEventById(id, agentId) {
  return prisma.event.findFirst({
    where: { id, assignedAgentId: agentId },
    include: {
      attendees: {
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
      },
      transaction: {
        select: { id: true, address: true, stage: true, type: true },
      },
      property: {
        select: { id: true, address: true, city: true, state: true },
      },
    },
  });
}

export async function createEvent(agentId, data) {
  const attendees = normalizeAttendeeInput(data.attendees);
  await ensureAgentContacts(agentId, attendees);

  const type = normalizeEventType(data.type);
  const customType = data.customType ? String(data.customType).trim() : null;
  const status = normalizeEventStatus(data.status);

  const created = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        type,
        customType,
        title: eventTitle(type, customType),
        description: data.description ? String(data.description) : null,
        location: data.location ? String(data.location) : null,
        startAt: toDate(data.startAt, new Date()),
        endAt: toDate(data.endAt, new Date()),
        isAllDay: Boolean(data.isAllDay),
        timezone: data.timezone ? String(data.timezone) : null,
        status,
        assignedAgentId: agentId,
        transactionId: data.transactionId ? String(data.transactionId) : null,
        propertyId: data.propertyId ? String(data.propertyId) : null,
      },
    });

    if (attendees.length) {
      await tx.eventAttendee.createMany({
        data: attendees.map((attendee) => ({
          eventId: event.id,
          contactId: attendee.contactId,
          role: attendee.role,
        })),
      });
    }

    return event;
  });

  const eventForSync = await getEventForSync(created.id, agentId);
  try {
    const syncData = await syncEventToGoogle(eventForSync, agentId);
    await prisma.event.update({
      where: { id: created.id },
      data: syncData,
    });
  } catch (error) {
    if (!isExpectedGoogleUnavailable(error)) {
      await prisma.event.update({
        where: { id: created.id },
        data: { providerSyncError: error.message || 'Failed to sync with Google Calendar.' },
      });
    }
  }

  return getEventById(created.id, agentId);
}

export async function updateEvent(id, agentId, data) {
  const existing = await prisma.event.findFirst({
    where: { id, assignedAgentId: agentId },
    include: { attendees: true },
  });
  if (!existing) return null;

  const attendeesInput = data.attendees ? normalizeAttendeeInput(data.attendees) : null;
  if (attendeesInput) {
    await ensureAgentContacts(agentId, attendeesInput);
  }

  const type = data.type !== undefined ? normalizeEventType(data.type) : existing.type;
  const customType = data.customType !== undefined ? (data.customType ? String(data.customType).trim() : null) : existing.customType;
  const status = data.status !== undefined ? normalizeEventStatus(data.status) : undefined;

  await prisma.$transaction(async (tx) => {
    const updateData: Prisma.EventUncheckedUpdateInput = {
      ...(data.type !== undefined ? { type, title: eventTitle(type, customType) } : {}),
      ...(data.customType !== undefined ? { customType, title: eventTitle(type, customType) } : {}),
      ...(data.description !== undefined ? { description: data.description ? String(data.description) : null } : {}),
      ...(data.location !== undefined ? { location: data.location ? String(data.location) : null } : {}),
      ...(data.startAt !== undefined ? { startAt: toDate(data.startAt, existing.startAt) } : {}),
      ...(data.endAt !== undefined ? { endAt: toDate(data.endAt, existing.endAt) } : {}),
      ...(data.isAllDay !== undefined ? { isAllDay: Boolean(data.isAllDay) } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone ? String(data.timezone) : null } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(data.transactionId !== undefined ? { transactionId: data.transactionId ? String(data.transactionId) : null } : {}),
      ...(data.propertyId !== undefined ? { propertyId: data.propertyId ? String(data.propertyId) : null } : {}),
    };

    await tx.event.update({
      where: { id },
      data: updateData,
    });

    if (attendeesInput) {
      await tx.eventAttendee.deleteMany({ where: { eventId: id } });
      if (attendeesInput.length) {
        await tx.eventAttendee.createMany({
          data: attendeesInput.map((attendee) => ({
            eventId: id,
            contactId: attendee.contactId,
            role: attendee.role,
          })),
        });
      }
    }
  });

  const eventForSync = await getEventForSync(id, agentId);
  try {
    const syncData = await syncEventToGoogle(eventForSync, agentId);
    await prisma.event.update({ where: { id }, data: syncData });
  } catch (error) {
    if (!isExpectedGoogleUnavailable(error)) {
      await prisma.event.update({
        where: { id },
        data: { providerSyncError: error.message || 'Failed to sync with Google Calendar.' },
      });
    }
  }

  return getEventById(id, agentId);
}

export async function deleteEvent(id, agentId) {
  const existing = await prisma.event.findFirst({
    where: { id, assignedAgentId: agentId },
  });
  if (!existing) return false;

  if (existing.providerEventId) {
    await deleteCalendarEvent(agentId, existing.providerEventId).catch(() => undefined);
  }

  await prisma.event.delete({ where: { id } });
  return true;
}

export async function addEventAttendee(eventId, agentId, data) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, assignedAgentId: agentId },
  });
  if (!event) return null;

  const attendees = normalizeAttendeeInput([data]);
  if (!attendees.length) {
    const error = new Error('contactId is required.');
    error.status = 400;
    throw error;
  }
  await ensureAgentContacts(agentId, attendees);

  await prisma.eventAttendee.upsert({
    where: {
      eventId_contactId: {
        eventId,
        contactId: attendees[0].contactId,
      },
    },
    update: { role: attendees[0].role },
    create: {
      eventId,
      contactId: attendees[0].contactId,
      role: attendees[0].role,
    },
  });

  return updateEvent(eventId, agentId, {});
}

export async function removeEventAttendee(eventId, attendeeId, agentId) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, assignedAgentId: agentId },
  });
  if (!event) return false;

  const attendee = await prisma.eventAttendee.findFirst({
    where: { id: attendeeId, eventId },
  });
  if (!attendee) return false;

  await prisma.eventAttendee.delete({ where: { id: attendeeId } });
  await updateEvent(eventId, agentId, {});
  return true;
}

const EVENT_TYPE_TO_INTERACTION_TYPE = {
  HOME_TOUR: 'TOUR',
  WALKTHROUGH: 'TOUR',
  BUYER_CONSULTATION: 'CONSULT',
  LISTING_CONSULTATION: 'CONSULT',
  MEETING: 'MEETING',
  INSPECTION: 'MEETING',
  CLOSING: 'MEETING',
  APPRAISAL: 'MEETING',
  OTHER: 'MEETING',
};

export async function markCompleted(id, agentId, notes = '') {
  const existing = await prisma.event.findFirst({
    where: { id, assignedAgentId: agentId },
    include: {
      attendees: { select: { contactId: true } },
    },
  });
  if (!existing) return null;

  const interactionType = EVENT_TYPE_TO_INTERACTION_TYPE[existing.type] || 'MEETING';
  const occurredAt = existing.startAt;

  await prisma.$transaction(async (tx) => {
    await tx.event.update({ where: { id }, data: { status: 'COMPLETED' } });

    if (existing.attendees.length) {
      await tx.contactInteraction.createMany({
        data: existing.attendees.map((a) => ({
          contactId: a.contactId,
          type: interactionType,
          subject: existing.title,
          body: notes || null,
          occurredAt,
        })),
      });
    }
  });

  return getEventById(id, agentId);
}
