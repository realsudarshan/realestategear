import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import type { AuthUser } from '../types/express.js';

function isAuthUser(decoded: string | jwt.JwtPayload): decoded is AuthUser {
  return typeof decoded === 'object' && typeof decoded.id === 'string';
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const authMiddleware: RequestHandler = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, secret);
    if (!isAuthUser(decoded)) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (getErrorName(error) === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (getErrorName(error) === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(401).json({ error: 'Authentication failed' });
  }
};

export const optionalAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.user = null;
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    if (token) {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        logger.warn('JWT_SECRET not set for optional auth');
        req.user = null;
        return next();
      }
      const decoded = jwt.verify(token, secret);
      req.user = isAuthUser(decoded) ? decoded : null;
    }
  } catch (error) {
    logger.warn('Optional auth failed:', { error: getErrorMessage(error) });
    req.user = null;
  }

  next();
};

export const requireRole = (roles: string[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
