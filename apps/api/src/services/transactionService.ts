import { Prisma, prisma } from 'db';
import { ensureTransactionDocumentsForTransaction } from './transactionDocumentService.js';
import { upsertDocument, deleteDocument, toTransactionDoc } from '../search/index.js';

export async function getTransactions(userId, filters: Record<string, any> = {}) {
  const { page = 1, limit = 20, stage, stages, type, sortBy = 'created_desc', search } = filters;
  const skip = (page - 1) * limit;
  const take = parseInt(limit);

  const member = await prisma.accountMember.findFirst({ where: { userId } });
  if (!member) return { transactions: [], pagination: { page: parseInt(page), limit: take, total: 0, totalPages: 0 } };

  const where: Prisma.TransactionWhereInput = { accountId: member.accountId };
  if (stages) {
    const stageList = String(stages).split(',').filter(Boolean);
    if (stageList.length) where.stage = { in: stageList };
  } else if (stage) {
    where.stage = stage;
  }
  if (type) where.type = type;
  if (search && String(search).trim().length >= 2) {
    const q = String(search).trim();
    where.OR = [
      // Transaction.address is a denormalized string set when no Property row
      // is linked (e.g. seed data, off-MLS deals).
      { address: { contains: q, mode: 'insensitive' } },
      { property: { address: { contains: q, mode: 'insensitive' } } },
      { property: { city: { contains: q, mode: 'insensitive' } } },
      { parties: { some: { contact: { OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
      ] } } } },
    ];
  }

  let orderBy;
  switch (sortBy) {
    case 'closing_asc': orderBy = { closingDate: 'asc' }; break;
    case 'price_desc': orderBy = { listPrice: 'desc' }; break;
    default: orderBy = { createdAt: 'desc' };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where, skip, take, orderBy,
      include: {
        parties: {
          include: {
            contact: { select: { id: true, firstName: true, lastName: true, type: true, avatarUrl: true } },
          },
        },
        property: { select: { id: true, address: true, city: true, state: true } },
        _count: { select: { tasks: true, transactionNotes: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions,
    pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
  };
}

export async function getTransactionById(id) {
  await ensureTransactionDocumentsForTransaction(id);
  return prisma.transaction.findUnique({
    where: { id },
    include: {
      parties: {
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, type: true, avatarUrl: true } },
        },
      },
      property: {
        select: {
          id: true,
          address: true,
          city: true,
          state: true,
          listings: {
            select: { id: true, status: true, listDate: true, createdAt: true },
            orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
            take: 1,
          },
        },
      },
      tasks: { orderBy: { dueDate: 'asc' } },
      transactionNotes: { orderBy: { createdAt: 'desc' }, take: 20 },
      milestones: {
        orderBy: { date: 'asc' },
        include: {
          milestoneDefinition: {
            select: { id: true, key: true, label: true, sortOrder: true, required: true },
          },
        },
      },
      events: {
        orderBy: { startAt: 'asc' },
        include: {
          attendees: {
            include: {
              contact: {
                select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
              },
            },
          },
        },
      },
      documents: {
        orderBy: { createdAt: 'asc' },
        include: {
          documentDefinition: {
            select: { id: true, key: true, label: true, required: true, sortOrder: true },
          },
          matchedAttachment: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              sizeBytes: true,
              suggestedDocType: true,
              suggestedConfidence: true,
              message: {
                select: {
                  id: true,
                  subject: true,
                  snippet: true,
                  sentAt: true,
                  providerMessageId: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function createTransaction(userId, data) {
  const member = await prisma.accountMember.findFirst({ where: { userId } });
  if (!member) throw Object.assign(new Error('User has no account'), { statusCode: 403 });

  const { parties, ...txData } = data;
  const tx = await prisma.transaction.create({
    data: {
      ...txData,
      accountId: member.accountId,
      assignedAgentId: userId,
      parties: parties?.length
        ? { create: parties.map((p) => ({ contactId: p.contactId, role: p.role })) }
        : undefined,
    },
    include: {
      parties: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  upsertDocument('transactions', toTransactionDoc(tx));
  return tx;
}

export async function updateTransaction(id, data) {
  const { parties, ...txData } = data;

  const tx = await prisma.transaction.update({
    where: { id },
    data: txData,
    include: {
      parties: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });

  upsertDocument('transactions', toTransactionDoc(tx));
  return tx;
}

export async function deleteTransaction(id) {
  try {
    await prisma.transaction.delete({ where: { id } });
    deleteDocument('transactions', id);
    return true;
  } catch (error) {
    if (error.code === 'P2025') return false;
    throw error;
  }
}

export async function addParty(transactionId, contactId, role) {
  return prisma.transactionParty.create({
    data: { transactionId, contactId, role },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function removeParty(transactionId, contactId, role) {
  try {
    await prisma.transactionParty.delete({
      where: { transactionId_contactId_role: { transactionId, contactId, role } },
    });
    return true;
  } catch {
    return false;
  }
}

export async function getTransactionsByStage(userId, filters: Record<string, any> = {}) {
  const { type } = filters;
  const stages = ['PROSPECT', 'SIGNED', 'LISTED', 'PENDING', 'CLOSED'];

  const member = await prisma.accountMember.findFirst({ where: { userId } });
  if (!member) return Object.fromEntries(stages.map((s) => [s, []]));

  const where: Prisma.TransactionWhereInput = { accountId: member.accountId, stage: { in: stages } };
  if (type) where.type = type;

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      parties: {
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const grouped = {};
  for (const s of stages) grouped[s] = [];
  for (const tx of transactions) {
    if (grouped[tx.stage]) grouped[tx.stage].push(tx);
  }

  return grouped;
}
