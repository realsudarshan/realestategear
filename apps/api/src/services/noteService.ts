import { Prisma, prisma } from 'db';
import { upsertDocument, deleteDocument, toNoteDoc } from '../search/index.js';

export async function getNotes(authorId, filters: Record<string, any> = {}) {
  const { page = 1, limit = 20, contactId, transactionId, propertyId, eventId } = filters;
  const skip = (page - 1) * limit;
  const take = parseInt(limit);

  const where: Prisma.NoteWhereInput = { authorId };
  if (contactId) where.contactId = contactId;
  if (transactionId) where.transactionId = transactionId;
  if (propertyId) where.propertyId = propertyId;
  if (eventId) where.eventId = eventId;

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where, skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        transaction: { select: { id: true, address: true } },
        event: { select: { id: true, title: true, startAt: true } },
      },
    }),
    prisma.note.count({ where }),
  ]);

  return { notes, pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) } };
}

export async function createNote(authorId, data) {
  const noteData = { ...data };
  if (noteData.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: noteData.eventId, assignedAgentId: authorId },
      include: { attendees: { select: { contactId: true }, take: 1 } },
    });
    if (!event) {
      const error = new Error('Event not found.');
      error.status = 404;
      throw error;
    }
    noteData.contactId = noteData.contactId ?? event.attendees[0]?.contactId ?? null;
    noteData.transactionId = noteData.transactionId ?? event.transactionId ?? null;
  }

  const include = {
    contact: { select: { id: true, firstName: true, lastName: true } },
    transaction: { select: { id: true, address: true } },
    event: { select: { id: true, title: true, startAt: true } },
  } as const;

  // One note per event — upsert so callers never need to know whether a note exists yet.
  if (noteData.eventId) {
    const note = await prisma.note.upsert({
      where: { eventId: noteData.eventId },
      create: { ...noteData, authorId },
      update: { body: noteData.body },
      include,
    });
    upsertDocument('notes', toNoteDoc(note));
    return note;
  }

  const note = await prisma.note.create({
    data: { ...noteData, authorId },
    include,
  });
  upsertDocument('notes', toNoteDoc(note));
  return note;
}

export async function updateNote(id, authorId, data) {
  const note = await prisma.note.findFirst({ where: { id, authorId } });
  if (!note) return null;
  const updated = await prisma.note.update({ where: { id }, data });
  upsertDocument('notes', toNoteDoc(updated));
  return updated;
}

export async function deleteNote(id, authorId) {
  const note = await prisma.note.findFirst({ where: { id, authorId } });
  if (!note) return false;
  await prisma.note.delete({ where: { id } });
  deleteDocument('notes', id);
  return true;
}
