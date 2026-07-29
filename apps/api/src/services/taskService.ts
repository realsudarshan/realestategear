import { Prisma, prisma } from 'db';
import { upsertDocument, deleteDocument, toTaskDoc } from '../search/index.js';
import { refresh as refreshContactDenorm } from './contactActivityDenormService.js';

export async function getTasks(agentId, filters: Record<string, any> = {}) {
  const { page = 1, limit = 20, status, priority, contactId, transactionId, search, sortBy = 'due_asc' } = filters;
  const skip = (page - 1) * limit;
  const take = parseInt(limit);

  const where: Prisma.TaskWhereInput = { assignedToId: agentId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (contactId) where.contactId = contactId;
  if (transactionId) where.transactionId = transactionId;
  if (search && String(search).trim().length >= 2) {
    const q = String(search).trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  let orderBy;
  switch (sortBy) {
    case 'priority_desc': orderBy = [{ priority: 'desc' }, { dueDate: 'asc' }]; break;
    case 'created_desc': orderBy = { createdAt: 'desc' }; break;
    default: orderBy = [{ dueDate: 'asc' }, { priority: 'desc' }];
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where, skip, take, orderBy,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        transaction: { select: { id: true, address: true, stage: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks, pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) } };
}

export async function createTask(agentId, data) {
  const task = await prisma.task.create({
    data: {
      ...data,
      assignedToId: agentId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      transaction: { select: { id: true, address: true, stage: true } },
    },
  });
  upsertDocument('tasks', toTaskDoc(task));
  if (task.contactId) refreshContactDenorm(task.contactId).catch(() => {});
  return task;
}

export async function updateTask(id, agentId, data) {
  const task = await prisma.task.findFirst({ where: { id, assignedToId: agentId } });
  if (!task) return null;

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate,
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      transaction: { select: { id: true, address: true, stage: true } },
    },
  });
  upsertDocument('tasks', toTaskDoc(updated));
  if (updated.contactId) refreshContactDenorm(updated.contactId).catch(() => {});
  return updated;
}

export async function deleteTask(id, agentId) {
  const task = await prisma.task.findFirst({ where: { id, assignedToId: agentId } });
  if (!task) return false;
  await prisma.task.delete({ where: { id } });
  deleteDocument('tasks', id);
  if (task.contactId) refreshContactDenorm(task.contactId).catch(() => {});
  return true;
}
