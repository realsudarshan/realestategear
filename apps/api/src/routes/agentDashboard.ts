import { Router } from 'express';
import { prisma } from 'db';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

router.get('/', async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const member = await prisma.accountMember.findFirst({ where: { userId: req.user.id } });
    if (!member) return res.json({ stats: { activeContacts: 0, openTransactions: 0, pendingTasks: 0, closedThisMonth: 0 }, recentContacts: [], upcomingTasks: [] });
    const { accountId } = member;
    const agentId = req.user.id;

    const [
      activeContacts,
      openTransactions,
      pendingTasks,
      closedThisMonth,
      recentContacts,
      upcomingTasks,
    ] = await Promise.all([
      prisma.contact.count({
        where: {
          accountId,
          stage: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'ACTIVE'] },
        },
      }).catch(() => 0),
      prisma.transaction.count({
        where: {
          assignedAgentId: agentId,
          stage: { in: ['PROSPECT', 'PRE_LISTING', 'ACTIVE', 'UNDER_CONTRACT', 'PENDING'] },
        },
      }).catch(() => 0),
      prisma.task.count({
        where: {
          assignedToId: agentId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }).catch(() => 0),
      prisma.transaction.count({
        where: {
          assignedAgentId: agentId,
          stage: 'CLOSED',
          closingDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }).catch(() => 0),
      prisma.contact.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          type: true,
          stage: true,
          email: true,
          phone: true,
          createdAt: true,
        },
      }).catch(() => []),
      prisma.task.findMany({
        where: {
          assignedToId: agentId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          status: true,
        },
      }).catch(() => []),
    ]);

    res.json({
      stats: {
        activeContacts,
        openTransactions,
        pendingTasks,
        closedThisMonth,
      },
      recentContacts,
      upcomingTasks,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
