import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { adminAuth } from '../../../middleware/adminAuth.js';
import { createMockReq, createMockRes, createMockNext } from '../../utils/testHelpers.js';

describe('adminAuth middleware', () => {
  let req, res, next;
  const originalAdminSecret = process.env.ADMIN_SECRET;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    next = createMockNext();
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SECRET = originalAdminSecret;
  });

  it('returns 401 when ADMIN_SECRET env var is not set', () => {
    delete process.env.ADMIN_SECRET;

    adminAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when x-admin-secret header is missing', () => {
    process.env.ADMIN_SECRET = 'test-secret';

    adminAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when x-admin-secret header is wrong', () => {
    process.env.ADMIN_SECRET = 'correct-secret';
    req.headers['x-admin-secret'] = 'wrong-secret';

    adminAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when x-admin-secret matches ADMIN_SECRET', () => {
    process.env.ADMIN_SECRET = 'correct-secret';
    req.headers['x-admin-secret'] = 'correct-secret';

    adminAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
