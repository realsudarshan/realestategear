import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware, optionalAuth, requireRole } from '../../../middleware/auth.js';
import { createMockReq, createMockRes, createMockNext, createAuthToken } from '../../utils/testHelpers.js';

vi.mock('../../../utils/logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn() }
}));

describe('Auth Middleware - unit tests', () => {
  let req, res, next;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    next = createMockNext();
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = originalJwtSecret;
  });

  describe('authMiddleware', () => {
    it('should reject requests without authorization header', async () => {
      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No authorization header provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with malformed authorization header', async () => {
      req.headers.authorization = 'InvalidFormat';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests when JWT_SECRET is not set', async () => {
      delete process.env.JWT_SECRET;
      req.headers.authorization = 'Bearer valid-token';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server configuration error' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid JWT token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with expired JWT token', async () => {
      const expiredToken = jwt.sign(
        { id: 1, email: 'test@example.com', exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_SECRET
      );
      req.headers.authorization = `Bearer ${expiredToken}`;

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept requests with valid JWT token', async () => {
      const validToken = createAuthToken();
      req.headers.authorization = `Bearer ${validToken}`;

      await authMiddleware(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-1');
      expect(req.user.email).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should continue without user when no authorization header is provided', async () => {
      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user when JWT_SECRET is not set', async () => {
      delete process.env.JWT_SECRET;
      req.headers.authorization = 'Bearer some-token';

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user when token is invalid', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set user when valid token is provided', async () => {
      const validToken = createAuthToken();
      req.headers.authorization = `Bearer ${validToken}`;

      await optionalAuth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-1');
      expect(req.user.email).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should reject requests without authenticated user', async () => {
      const roleMiddleware = requireRole(['ADMIN']);
      req.user = null;

      await roleMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests when user role is not in required roles', async () => {
      const roleMiddleware = requireRole(['ADMIN']);
      req.user = { id: 1, role: 'USER' };

      await roleMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow requests when user role is in required roles', async () => {
      const roleMiddleware = requireRole(['ADMIN', 'MODERATOR']);
      req.user = { id: 1, role: 'ADMIN' };

      await roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow requests when user has one of multiple required roles', async () => {
      const roleMiddleware = requireRole(['ADMIN', 'MODERATOR']);
      req.user = { id: 1, role: 'MODERATOR' };

      await roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
