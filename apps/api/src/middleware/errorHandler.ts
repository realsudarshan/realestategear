import type { ErrorRequestHandler } from 'express';
import logger from '../utils/logger.js';

type AppError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
  meta?: { target?: unknown };
};

export const errorHandler: ErrorRequestHandler = (error: AppError, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    params: req.params,
    body: req.body
  });

  // Prisma errors
  if (error.code && error.code.startsWith('P')) {
    switch (error.code) {
      case 'P2002':
        return res.status(409).json({
          error: 'Unique constraint violation',
          field: error.meta?.target
        });
      case 'P2025':
        return res.status(404).json({
          error: 'Record not found'
        });
      case 'P2003':
        return res.status(400).json({
          error: 'Foreign key constraint violation'
        });
      default:
        return res.status(500).json({
          error: 'Database error',
          code: error.code
        });
    }
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }

  if (error.status) {
    return res.status(error.status).json({
      error: error.message || 'Request failed'
    });
  }

  // Default server error
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      message: error.message,
      stack: error.stack
    })
  });
};
