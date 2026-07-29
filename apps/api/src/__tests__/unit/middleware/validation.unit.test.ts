import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Joi from 'joi';
import { validateRequest } from '../../../middleware/validation.js';
import { createMockReq, createMockRes, createMockNext } from '../../utils/testHelpers.js';

vi.mock('../../../utils/logger.js', () => ({
  default: { warn: vi.fn() }
}));

describe('Validation Middleware - unit tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    next = createMockNext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateRequest', () => {
    it('should pass through when no validation schemas are provided', async () => {
      const middleware = validateRequest({});

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should validate body and pass when valid', async () => {
      const bodySchema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
      });

      const middleware = validateRequest({ body: bodySchema });
      req.body = { email: 'test@example.com', password: 'password123' };

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when body validation fails', async () => {
      const bodySchema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
      });

      const middleware = validateRequest({ body: bodySchema });
      req.body = { email: 'invalid-email', password: '123' };

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      // Use objectContaining to ignore the extra `fields` key added by the middleware
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.objectContaining({
            body: expect.arrayContaining([
              expect.stringContaining('email'),
              expect.stringContaining('password')
            ])
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should validate query parameters and pass when valid', async () => {
      const querySchema = Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10)
      });

      const middleware = validateRequest({ query: querySchema });
      req.query = { page: '2', limit: '20' };

      await middleware(req, res, next);

      expect(req.query.page).toBe(2);
      expect(req.query.limit).toBe(20);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when query validation fails', async () => {
      const querySchema = Joi.object({
        page: Joi.number().integer().min(1).required(),
        limit: Joi.number().integer().min(1).max(100).required()
      });

      const middleware = validateRequest({ query: querySchema });
      req.query = { page: '0', limit: '200' };

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.objectContaining({
            query: expect.arrayContaining([
              expect.stringContaining('page'),
              expect.stringContaining('limit')
            ])
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should validate URL parameters and pass when valid', async () => {
      const paramsSchema = Joi.object({
        id: Joi.number().integer().positive().required()
      });

      const middleware = validateRequest({ params: paramsSchema });
      req.params = { id: '123' };

      await middleware(req, res, next);

      expect(req.params.id).toBe(123);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when params validation fails', async () => {
      const paramsSchema = Joi.object({
        id: Joi.number().integer().positive().required()
      });

      const middleware = validateRequest({ params: paramsSchema });
      req.params = { id: 'invalid' };

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.objectContaining({
            params: expect.arrayContaining([
              expect.stringContaining('id')
            ])
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should validate multiple schemas and accumulate errors', async () => {
      const schemas = {
        body: Joi.object({
          email: Joi.string().email().required()
        }),
        query: Joi.object({
          page: Joi.number().integer().min(1).required()
        }),
        params: Joi.object({
          id: Joi.number().integer().positive().required()
        })
      };

      const middleware = validateRequest(schemas);
      req.body = { email: 'invalid-email' };
      req.query = { page: '0' };
      req.params = { id: 'invalid' };

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.objectContaining({
            body: expect.arrayContaining([expect.stringContaining('email')]),
            query: expect.arrayContaining([expect.stringContaining('page')]),
            params: expect.arrayContaining([expect.stringContaining('id')])
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should apply default values from Joi schemas', async () => {
      const querySchema = Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        sortBy: Joi.string().default('createdAt')
      });

      const middleware = validateRequest({ query: querySchema });
      req.query = {};

      await middleware(req, res, next);

      expect(req.query.page).toBe(1);
      expect(req.query.limit).toBe(10);
      expect(req.query.sortBy).toBe('createdAt');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should sanitize and transform values', async () => {
      const bodySchema = Joi.object({
        email: Joi.string().email().lowercase().required(),
        name: Joi.string().trim().required(),
        age: Joi.number().integer().min(0).required()
      });

      const middleware = validateRequest({ body: bodySchema });
      req.body = {
        email: 'TEST@EXAMPLE.COM',
        name: '  John Doe  ',
        age: '25'
      };

      await middleware(req, res, next);

      expect(req.body.email).toBe('test@example.com');
      expect(req.body.name).toBe('John Doe');
      expect(req.body.age).toBe(25);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
