import { Router } from 'express';
import { prisma } from 'db';
import { verifyUnsubscribeToken } from '../services/lifecycleEmailService.js';
import logger from '../utils/logger.js';

const router = Router();

router.get('/unsubscribe', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return res.status(400).type('html').send('<p>That unsubscribe link is invalid or expired.</p>');
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { marketingEmailsOptOutAt: new Date() },
    });
  } catch (err) {
    logger.warn('Unsubscribe failed:', { error: err?.message, userId });
    return res.status(500).type('html').send('<p>We could not unsubscribe you. Reply to the email and I will handle it.</p>');
  }

  return res.type('html').send('<p>You are unsubscribed from Real Estate Gear setup emails.</p>');
});

export default router;
