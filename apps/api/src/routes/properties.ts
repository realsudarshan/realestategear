import { Router } from 'express';
import Joi from 'joi';
import {
  getProperties,
  getPropertyById,
  getPropertyByIdentifier,
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyMedia,
  addPropertyMedia,
} from '../services/propertyService.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';

const router = Router();

// Validation schemas
const createPropertySchema = Joi.object({
  address: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zipCode: Joi.string().required(),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  parcelId: Joi.string().optional(),
  bedrooms: Joi.number().integer().min(0).optional(),
  bathrooms: Joi.number().positive().optional(),
  squareFeet: Joi.number().integer().positive().optional(),
  lotSize: Joi.number().positive().optional(),
  yearBuilt: Joi.number().integer().min(1800).max(new Date().getFullYear()).optional(),
  propertyType: Joi.string().optional(),
});

// For updates, all fields are optional (partial patch semantics)
const updatePropertySchema = createPropertySchema.fork(
  ['address', 'city', 'state', 'zipCode'],
  (schema) => schema.optional()
);

const addMediaSchema = Joi.object({
  url: Joi.string().uri().required(),
  caption: Joi.string().optional(),
  order: Joi.number().integer().min(0).optional()
});

// Query validation for listing properties.
// Validates the fields most likely to cause errors (page/limit/price); unknown params are passed through.
const listPropertiesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  bedrooms: Joi.number().integer().min(0).optional(),
  minBedrooms: Joi.number().integer().min(0).optional(),
  maxBedrooms: Joi.number().integer().min(0).optional(),
  bathrooms: Joi.number().positive().optional(),
  minBathrooms: Joi.number().positive().optional(),
  maxBathrooms: Joi.number().positive().optional(),
  minSqFt: Joi.number().integer().positive().optional(),
  maxSqFt: Joi.number().integer().positive().optional(),
  minYearBuilt: Joi.number().integer().optional(),
  maxYearBuilt: Joi.number().integer().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  propertyType: Joi.string().optional(),
  sortBy: Joi.string().optional(),
  search: Joi.string().optional(),
}).unknown(true); // Allow extra query params (e.g. sortOrder) without rejection

// GET /api/properties - Get all properties with filtering, sorting, pagination
router.get('/', validateRequest({ query: listPropertiesSchema }), async (req, res, next) => {
  try {
    const result = await getProperties(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/properties/:identifier - Get a single property by ID or slug
router.get('/:identifier', async (req, res, next) => {
  try {
    const property = await getPropertyByIdentifier(req.params.identifier);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    next(error);
  }
});

// POST /api/properties - Create a new property (Admin only)
router.post(
  '/',
  authMiddleware,
  requireRole(['ADMIN']),
  validateRequest({ body: createPropertySchema }),
  async (req, res, next) => {
    try {
      const property = await createProperty(req.body);
      res.status(201).json(property);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/properties/:id - Update a property (Admin only)
router.put(
  '/:id',
  authMiddleware,
  requireRole(['ADMIN']),
  validateRequest({ body: updatePropertySchema }),
  async (req, res, next) => {
    try {
      const property = await updateProperty(req.params.id, req.body);
      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }
      res.json(property);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/properties/:id - Delete a property (Admin only)
router.delete('/:id', authMiddleware, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const deleted = await deleteProperty(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/properties/:id/media - Get media for a property
router.get('/:id/media', async (req, res, next) => {
  try {
    const media = await getPropertyMedia(req.params.id);
    res.json(media);
  } catch (error) {
    next(error);
  }
});

// POST /api/properties/:id/media - Add media to a property (Admin only)
router.post(
  '/:id/media',
  authMiddleware,
  requireRole(['ADMIN']),
  validateRequest({ body: addMediaSchema }),
  async (req, res, next) => {
    try {
      const { url, caption, order } = req.body;
      const media = await addPropertyMedia(req.params.id, { url, caption, order });
      res.status(201).json(media);
    } catch (error) {
      next(error);
    }
  }
);

export default router;