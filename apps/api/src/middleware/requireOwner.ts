import type { RequestHandler } from 'express';
import { prisma } from 'db';

/**
 * Express middleware that gates a route to the OWNER of the requester's Account.
 * Must run AFTER authMiddleware (relies on req.user.id + req.user.accountId).
 * Used for billing routes — only the brokerage owner can subscribe / open the
 * customer portal.
 */
export const requireOwner: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user?.id || !req.user?.accountId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const member = await prisma.accountMember.findFirst({
      where: { userId: req.user.id, accountId: req.user.accountId },
      select: { role: true },
    });
    if (!member || member.role !== 'OWNER') {
      return res.status(403).json({ error: 'Owner-only action' });
    }
    next();
  } catch (err) {
    next(err);
  }
};
