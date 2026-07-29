import { Router } from 'express';
import { cache } from '../middleware/cache.js';
import { requireRole } from '../middleware/auth.js';
import {
  completeOAuthCallback,
  disconnectGoogleAccount,
  getCalendarEvents,
  getConnectionStatus,
  getContactGoogleActivity,
  getGoogleConnectScopes,
  getGoogleProviderName,
} from '../services/googleWorkspaceService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

router.get('/status', async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const status = await getConnectionStatus(req.user.id);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

router.get('/scopes', (req, res) => {
  res.json({
    provider: getGoogleProviderName(),
    scopes: getGoogleConnectScopes(),
  });
});

router.post('/oauth/callback', async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const { code, redirectUri } = req.body;
    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'Code and redirectUri are required.' });
    }

    const result = await completeOAuthCallback(req.user.id, { code, redirectUri });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/connection', async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const result = await disconnectGoogleAccount(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/calendar',
  cache({
    ttl: 60,
    keyGenerator: (req) => `google:calendar:${req.user?.id ?? 'anonymous'}:${req.originalUrl}`,
  }),
  async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
      const pageToken = typeof req.query.pageToken === 'string' ? req.query.pageToken : undefined;
      if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

      const data = await getCalendarEvents(req.user.id, { limit, pageToken });
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/contacts/:contactId/activity',
  cache({
    ttl: 30,
    keyGenerator: (req) => `google:contact-activity:${req.user?.id ?? 'anonymous'}:${req.params.contactId}`,
  }),
  async (req, res, next) => {
    try {
      if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

      const data = await getContactGoogleActivity(req.user.id, req.params.contactId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
