import { Router } from 'express';
import bcrypt from 'bcrypt';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { prisma } from 'db';
import { sendWelcome } from 'email';
import { validateRequest } from '../middleware/validation.js';
import { signUserToken, publicUser } from './auth.js';
import { getGoogleWebOAuthConfig, buildGoogleAuthorizeUrl, resolveOAuthCallbackBase } from '../utils/googleOAuthWeb.js';
import logger from '../utils/logger.js';
import { getJwtSecret } from '../utils/secrets.js';

const safeReturnPath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/');

const router = Router();

const namePartSchema = Joi.string().trim().max(100).allow('').optional();

const slugParamSchema = Joi.object({
  slug: Joi.string().trim().min(1).max(120).required(),
});

const consumerRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: namePartSchema,
  lastName: namePartSchema,
});

const consumerLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

async function resolveActivePortal(slug) {
  return prisma.portal.findUnique({
    where: { slug },
    select: { id: true, accountId: true, isActive: true },
  });
}

// POST /api/portals/:slug/auth/register — consumer signup scoped to a portal.
// Creates User(accountId=portal.accountId, portalId=portal.id, role='USER').
router.post(
  '/:slug/auth/register',
  validateRequest({ params: slugParamSchema, body: consumerRegisterSchema }),
  async (req, res, next) => {
    try {
      const portal = await resolveActivePortal(req.params.slug);
      if (!portal || !portal.isActive) {
        return res.status(404).json({ error: 'Portal not found' });
      }

      const { email, password, firstName, lastName } = req.body;
      const hashedPassword = await bcrypt.hash(password, 12);

      let user;
      try {
        user = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName: firstName || null,
            lastName: lastName || null,
            role: 'USER',
            emailVerified: false,
            accountId: portal.accountId,
            portalId: portal.id,
          },
        });
      } catch (err) {
        if (err?.code === 'P2002') {
          return res.status(409).json({ error: 'Email already registered on this portal' });
        }
        throw err;
      }

      sendWelcome(user.email, user.firstName || 'there').catch((emailErr) => {
        logger.warn('Failed to send welcome email:', emailErr?.message);
      });

      const token = signUserToken(user);
      res.status(201).json({
        message: 'Registered successfully',
        token,
        user: publicUser(user),
      });
    } catch (error) {
      logger.error('Consumer registration error:', error);
      next(error);
    }
  }
);

// POST /api/portals/:slug/auth/login — consumer login scoped to a portal.
router.post(
  '/:slug/auth/login',
  validateRequest({ params: slugParamSchema, body: consumerLoginSchema }),
  async (req, res, next) => {
    try {
      const portal = await resolveActivePortal(req.params.slug);
      if (!portal || !portal.isActive) {
        return res.status(404).json({ error: 'Portal not found' });
      }

      const { email, password } = req.body;
      const user = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          OR: [
            { portalId: portal.id },
            { memberships: { some: { accountId: portal.accountId, role: 'OWNER' } } },
          ],
        },
      });

      if (!user || !user.password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = signUserToken(user);
      res.json({
        message: 'Login successful',
        token,
        user: publicUser(user),
      });
    } catch (error) {
      logger.error('Consumer login error:', error);
      next(error);
    }
  }
);

// GET /api/portals/:slug/auth/google/start — initiate Google OAuth for a portal consumer
// Query params: return_to=PATH, callback_base=FRONTEND_BASE_URL
router.get('/:slug/auth/google/start', validateRequest({ params: slugParamSchema }), (req, res) => {
  const { clientId, clientSecret, redirectUri } = getGoogleWebOAuthConfig();
  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(503).json({ error: 'Google sign-in is not configured' });
  }

  const returnTo = safeReturnPath(typeof req.query.return_to === 'string' ? req.query.return_to : '/');
  const rawCallbackBase = typeof req.query.callback_base === 'string' ? req.query.callback_base : undefined;
  const callbackBase = resolveOAuthCallbackBase('portal', rawCallbackBase);
  if (!callbackBase) {
    return res.status(400).json({ error: 'invalid_callback_base' });
  }

  const state = jwt.sign(
    { purpose: 'google-oauth-web', authPurpose: 'portal', portalSlug: req.params.slug, returnTo, callbackBase },
    getJwtSecret(),
    { expiresIn: '10m' }
  );

  const url = buildGoogleAuthorizeUrl({ clientId, redirectUri, state });
  res.redirect(302, url);
});

export default router;
