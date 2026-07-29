import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { prisma } from 'db';
import { validateRequest } from '../middleware/validation.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { getJwtSecret } from '../utils/secrets.js';
import { sendPasswordReset, sendWelcome } from 'email';
import {
  getGoogleWebOAuthConfig,
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  isGoogleEmailVerified,
  resolveOAuthCallbackBase,
} from '../utils/googleOAuthWeb.js';

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    avatarUrl: user.avatarUrl,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

function signUserToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      accountId: user.accountId,
      portalId: user.portalId ?? null,
      avatarUrl: user.avatarUrl ?? null,
    },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

export { signUserToken, publicUser };

function safeReturnPath(raw) {
  if (!raw || typeof raw !== 'string') return '/';
  const s = raw.trim();
  if (!s.startsWith('/') || s.startsWith('//')) return '/';
  return s.slice(0, 512);
}

const namePartSchema = Joi.string()
  .trim()
  .max(100)
  .allow('')
  .optional();

const registerAgentSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: namePartSchema,
  lastName: namePartSchema,
  accountName: Joi.string().trim().min(2).max(120).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
});

const checkEmailSchema = Joi.object({
  email: Joi.string().email().required(),
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(100).allow(null, '').optional(),
  lastName: Joi.string().trim().min(2).max(100).allow(null, '').optional(),
  phoneNumber: Joi.string().allow('').optional(),
});

function normalizeOptionalName(value) {
  if (value == null) return null;
  const t = String(value).trim();
  if (t === '') return null;
  return t;
}

function validateNamePartsOrThrow(firstName, lastName, res) {
  if (firstName && firstName.length === 1) {
    return res.status(400).json({
      error: 'Validation failed',
      fields: { firstName: 'First name must be at least 2 characters' },
      details: { body: ['First name must be at least 2 characters'] },
    });
  }
  if (lastName && lastName.length === 1) {
    return res.status(400).json({
      error: 'Validation failed',
      fields: { lastName: 'Last name must be at least 2 characters' },
      details: { body: ['Last name must be at least 2 characters'] },
    });
  }
  if (firstName && firstName.length < 2) {
    return res.status(400).json({
      error: 'Validation failed',
      fields: { firstName: 'First name must be at least 2 characters' },
      details: { body: ['First name must be at least 2 characters'] },
    });
  }
  if (lastName && lastName.length < 2) {
    return res.status(400).json({
      error: 'Validation failed',
      fields: { lastName: 'Last name must be at least 2 characters' },
      details: { body: ['Last name must be at least 2 characters'] },
    });
  }
  return null;
}

// POST /api/auth/login — agent-space only (portalId IS NULL).
// Consumer login is served by POST /api/portals/:slug/auth/login.
router.post('/login', validateRequest({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), portalId: null },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({
        error: 'This account uses Google sign-in. Use Continue with Google.',
      });
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
    logger.error('Login error:', error);
    next(error);
  }
});

// POST /api/auth/register-agent — agent self-signup.
// Creates Account + User(role=AGENT, portalId=null) + AccountMember(role=OWNER) in one transaction.
//
// Stricter rate limit than the global 100/15min: tighten to 5 per IP per
// 15min to block signup abuse without hitting legitimate humans.
// Disabled in tests so unit-test request bursts aren't capped.
const registerAgentLimiter =
  process.env.NODE_ENV === 'test'
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many signups from this IP. Please try again in 15 minutes.' },
      });

router.post('/register-agent', registerAgentLimiter, validateRequest({ body: registerAgentSchema }), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, accountName } = req.body;

    const fn = normalizeOptionalName(firstName);
    const ln = normalizeOptionalName(lastName);

    const nameErr = validateNamePartsOrThrow(fn, ln, res);
    if (nameErr) return;

    const hashedPassword = await bcrypt.hash(password, 12);
    const normEmail = email.toLowerCase();

    let user;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: { name: accountName.trim() },
        });
        const created = await tx.user.create({
          data: {
            email: normEmail,
            password: hashedPassword,
            firstName: fn,
            lastName: ln,
            role: 'AGENT',
            emailVerified: false,
            accountId: account.id,
            portalId: null,
          },
        });
        await tx.accountMember.create({
          data: { accountId: account.id, userId: created.id, role: 'OWNER' },
        });
        return { account, user: created };
      });
      user = result.user;
    } catch (err) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'An agent with that email already exists' });
      }
      throw err;
    }

    const token = signUserToken(user);

    res.status(201).json({
      message: 'Agent registered successfully',
      token,
      user: publicUser(user),
    });
  } catch (error) {
    logger.error('Agent registration error:', error);
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: publicUser(user),
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    next(error);
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, validateRequest({ body: updateProfileSchema }), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, phoneNumber } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName === '' ? null : firstName,
        lastName: lastName === '' ? null : lastName,
        phoneNumber,
      },
    });

    res.json({
      user: publicUser(user),
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
});

// POST /api/auth/check-email — agent-space only (portalId IS NULL).
router.post('/check-email', validateRequest({ body: checkEmailSchema }), async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), portalId: null },
      select: { id: true },
    });

    res.json({
      exists: !!user,
      email: email.toLowerCase(),
    });
  } catch (error) {
    logger.error('Check email error:', error);
    next(error);
  }
});

// POST /api/auth/forgot-password — agent-space only (portalId IS NULL).
router.post('/forgot-password', validateRequest({ body: forgotPasswordSchema }), async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), portalId: null },
    });

    const generic = { message: 'Password reset instructions sent to email' };

    if (!user || !user.password) {
      return res.json(generic);
    }

    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password-reset' },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() + 3600000),
      },
    });

    try {
      await sendPasswordReset(user.email, resetToken, user.firstName);
    } catch (emailErr) {
      logger.warn('Failed to send password reset email:', emailErr.message);
    }

    res.json(generic);
  } catch (error) {
    logger.error('Forgot password error:', error);
    next(error);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', validateRequest({ body: resetPasswordSchema }), async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.passwordResetToken !== token) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (user.passwordResetExpires < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset password error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newToken = signUserToken(user);

    res.json({ token: newToken });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// GET /api/auth/google/start — redirect browser to Google
// Query params:
//   purpose=agent|portal  (default: agent)
//   portal_slug=XXX       (required when purpose=portal)
//   return_to=PATH        (safe path to redirect to after auth)
//   callback_base=URL     (frontend base URL to redirect to after auth; validated against allowlist)
router.get('/google/start', (req, res) => {
  const { clientId, clientSecret, redirectUri } = getGoogleWebOAuthConfig();
  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(503).json({ error: 'Google sign-in is not configured' });
  }

  const authPurpose = req.query.purpose === 'portal' ? 'portal' : 'agent';
  const portalSlug = authPurpose === 'portal' && typeof req.query.portal_slug === 'string'
    ? req.query.portal_slug.trim()
    : null;
  const returnTo = safeReturnPath(typeof req.query.return_to === 'string' ? req.query.return_to : '/');

  // The callback base must match the expected base for this purpose exactly —
  // no falling back to another app's domain on mismatch.
  const rawCallbackBase = typeof req.query.callback_base === 'string' ? req.query.callback_base : undefined;
  const callbackBase = resolveOAuthCallbackBase(authPurpose, rawCallbackBase);
  if (!callbackBase) {
    return res.status(400).json({ error: 'invalid_callback_base' });
  }

  const state = jwt.sign(
    { purpose: 'google-oauth-web', authPurpose, portalSlug, returnTo, callbackBase },
    getJwtSecret(),
    { expiresIn: '10m' }
  );

  const url = buildGoogleAuthorizeUrl({ clientId, redirectUri, state });
  res.redirect(302, url);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req, res) => {
  const defaultBase = process.env.FRONTEND_URL || process.env.WEB_APP_URL || 'http://localhost:3000';

  const failRedirect = (msg, base = defaultBase) => {
    const u = new URL('/login', base);
    u.searchParams.set('google_error', msg);
    res.redirect(302, u.toString());
  };

  try {
    const { clientId, clientSecret, redirectUri } = getGoogleWebOAuthConfig();
    if (!clientId || !clientSecret || !redirectUri) {
      return failRedirect('not_configured');
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const stateRaw = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !stateRaw) {
      return failRedirect('missing_code');
    }

    let decoded;
    try {
      decoded = jwt.verify(stateRaw, getJwtSecret());
    } catch {
      return failRedirect('invalid_state');
    }
    if (decoded.purpose !== 'google-oauth-web') {
      return failRedirect('invalid_state');
    }

    const { authPurpose, portalSlug, returnTo, callbackBase } = decoded;
    const redirectBase = callbackBase || defaultBase;
    const safeReturn = safeReturnPath(returnTo);

    const tokenResponse = await exchangeGoogleCode({ code, redirectUri, clientId, clientSecret });
    const accessToken = tokenResponse.access_token;
    if (!accessToken) {
      return failRedirect('no_access_token', redirectBase);
    }

    const userinfo = await fetchGoogleUserInfo(accessToken);
    const googleSub = userinfo.sub;
    const email = userinfo.email?.toLowerCase();
    if (!googleSub || !email) {
      return failRedirect('incomplete_profile', redirectBase);
    }
    if (!isGoogleEmailVerified(userinfo)) {
      return failRedirect('email_not_verified', redirectBase);
    }

    const given = userinfo.given_name || (userinfo.name ? userinfo.name.split(/\s+/)[0] : null) || null;
    const family = userinfo.family_name || null;
    const picture = userinfo.picture || null;

    let user;

    if (authPurpose === 'portal' && portalSlug) {
      // --- Portal consumer flow: upsert user scoped to the portal ---
      const portal = await prisma.portal.findUnique({
        where: { slug: portalSlug },
        select: { id: true, accountId: true, isActive: true },
      });
      if (!portal || !portal.isActive) {
        return failRedirect('portal_not_found', redirectBase);
      }

      user = await prisma.$transaction(async (tx) => {
        // Check for existing Google identity
        const identity = await tx.authIdentity.findUnique({
          where: { provider_providerAccountId: { provider: 'google', providerAccountId: googleSub } },
          include: { user: true },
        });
        if (identity?.user && identity.user.portalId === portal.id) {
          return tx.user.update({
            where: { id: identity.user.id },
            data: { emailVerified: true, avatarUrl: identity.user.avatarUrl || picture || undefined },
          });
        }

        // Check for existing portal user with same email
        const existing = await tx.user.findFirst({ where: { email, portalId: portal.id } });
        if (existing) {
          await tx.authIdentity.upsert({
            where: { provider_providerAccountId: { provider: 'google', providerAccountId: googleSub } },
            create: { provider: 'google', providerAccountId: googleSub, email, userId: existing.id },
            update: {},
          });
          return tx.user.update({
            where: { id: existing.id },
            data: { emailVerified: true, avatarUrl: existing.avatarUrl || picture || undefined },
          });
        }

        // Create new portal user
        const u = await tx.user.create({
          data: {
            email,
            password: null,
            firstName: given,
            lastName: family,
            avatarUrl: picture,
            role: 'USER',
            emailVerified: true,
            accountId: portal.accountId,
            portalId: portal.id,
          },
        });
        await tx.authIdentity.create({
          data: { provider: 'google', providerAccountId: googleSub, email, userId: u.id },
        });
        return u;
      });

      sendWelcome(user.email, user.firstName || 'there').catch((e) =>
        logger.warn('Failed to send welcome email:', e.message)
      );
    } else {
      // --- Agent flow: find existing agent user (portalId=null) ---
      const identity = await prisma.authIdentity.findUnique({
        where: { provider_providerAccountId: { provider: 'google', providerAccountId: googleSub } },
        include: { user: true },
      });
      if (identity?.user && identity.user.portalId === null) {
        user = await prisma.user.update({
          where: { id: identity.user.id },
          data: { emailVerified: true, avatarUrl: identity.user.avatarUrl || picture || undefined },
        });
      } else {
        const existing = await prisma.user.findFirst({ where: { email, portalId: null } });
        if (!existing) {
          return failRedirect('agent_not_found', redirectBase);
        }
        await prisma.authIdentity.upsert({
          where: { provider_providerAccountId: { provider: 'google', providerAccountId: googleSub } },
          create: { provider: 'google', providerAccountId: googleSub, email, userId: existing.id },
          update: {},
        });
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { emailVerified: true, avatarUrl: existing.avatarUrl || picture || undefined },
        });
      }
    }

    const token = signUserToken(user);
    const dest = new URL('/login', redirectBase);
    dest.searchParams.set('oauth', 'google');
    dest.searchParams.set('token', token);
    dest.searchParams.set('redirect', safeReturn);
    res.redirect(302, dest.toString());
  } catch (err) {
    logger.error('Google OAuth callback error:', err);
    failRedirect('oauth_failed');
  }
});

export default router;
