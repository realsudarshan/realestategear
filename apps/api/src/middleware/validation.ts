import type { RequestHandler } from 'express';
import logger from '../utils/logger.js';

type ValidationDetail = {
  message: string;
  path?: Array<string | number>;
};

type ValidationError = {
  details?: ValidationDetail[];
};

type ValidationSchema = {
  validate: (
    value: unknown,
    options: { abortEarly: boolean; stripUnknown?: boolean }
  ) => { error?: ValidationError; value: unknown };
};

type RequestSchemas = Partial<Record<'body' | 'query' | 'params', ValidationSchema>>;

export const validateRequest = (schemas: RequestSchemas): RequestHandler => {
  return (req, res, next) => {
    const errors: Partial<Record<'body' | 'query' | 'params', string[]>> = {};
    const fields: Record<string, string> = {};

    const mergeJoiFields = (error: ValidationError | undefined) => {
      if (!error?.details) return;
      for (const d of error.details) {
        const key = d.path?.length ? d.path.join('.') : '_root';
        if (!fields[key]) fields[key] = String(d.message).replace(/^"|"$/g, '');
      }
    };

    // Validate body
    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, { abortEarly: false, stripUnknown: true });
      if (error) {
        errors.body = error.details?.map((detail) => detail.message) ?? [];
        mergeJoiFields(error);
      } else {
        req.body = value;
      }
    }

    // Validate query parameters
    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.query = error.details?.map((detail) => detail.message) ?? [];
        mergeJoiFields(error);
      } else {
        // Express 5 exposes query through a prototype getter. Shadow it with
        // Joi's validated/coerced value so downstream handlers see defaults.
        Object.defineProperty(req, 'query', {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    }

    // Validate URL parameters
    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.params = error.details?.map((detail) => detail.message) ?? [];
        mergeJoiFields(error);
      } else {
        req.params = value;
      }
    }

    // If there are validation errors, return them
    if (Object.keys(errors).length > 0) {
      logger.warn('Validation failed:', errors);
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        ...(Object.keys(fields).length > 0 ? { fields } : {}),
      });
    }

    next();
  };
};
