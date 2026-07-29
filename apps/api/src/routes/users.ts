import express from 'express';
import Joi from 'joi';
import { prisma } from 'db';
import type { Prisma } from 'db';
import { requireRole } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { enqueue as enqueueLeadResponse } from '../services/leadResponseAgentService.js';
import { createInquiry, InquiryInputError } from '../services/inquiryService.js';

const router = express.Router();

// Validation schemas
const addFavoriteSchema = Joi.object({
  listingId: Joi.string().required()
});

const createInquirySchema = Joi.object({
  listingId: Joi.string().required(),
  message: Joi.string().min(10).required(),
  contactPreference: Joi.string().valid('EMAIL', 'PHONE', 'BOTH').default('EMAIL')
});

const updateInquirySchema = Joi.object({
  agentResponse: Joi.string().min(10).required()
});

const createSavedSearchSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  criteria: Joi.object().required()
});

const updateSavedSearchSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  criteria: Joi.object().optional()
}).min(1);

// GET /api/users/profile - Get current user profile
router.get('/profile', async (req, res, next) => {
  try {
    // Fetch fresh user data
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    next(error);
  }
});

// ===== FAVORITES ROUTES =====

// GET /api/users/favorites - Get user's favorite properties
router.get('/favorites', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const favorites = await prisma.userFavorites.findMany({
      where: { userId: req.user.id },
      include: {
        listing: {
          include: {
            property: { include: { media: { orderBy: { order: 'asc' }, take: 1 } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    const total = await prisma.userFavorites.count({
      where: { userId: req.user.id }
    });

    res.json({
      favorites: favorites.map(fav => ({
        id: fav.id,
        listing: fav.listing,
        favoritedAt: fav.createdAt
      })),
      pagination: {
        total,
        page,
        currentPage: page, // Add currentPage for frontend compatibility
        pages: Math.ceil(total / limit),
        totalPages: Math.ceil(total / limit), // Add totalPages for frontend compatibility
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching user favorites:', error);
    next(error);
  }
});

// POST /api/users/favorites - Add property to favorites
router.post('/favorites', validateRequest({ body: addFavoriteSchema }), async (req, res, next) => {
  try {
    const { listingId } = req.body;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const existingFavorite = await prisma.userFavorites.findUnique({
      where: { userId_listingId: { userId: req.user.id, listingId } },
    });
    if (existingFavorite) return res.status(400).json({ error: 'Listing already in favorites' });

    const favorite = await prisma.userFavorites.create({
      data: { userId: req.user.id, listingId },
      include: {
        listing: {
          include: { property: { select: { id: true, address: true, city: true, state: true } } },
        },
      },
    });

    res.status(201).json({
      message: 'Listing added to favorites',
      favorite: { id: favorite.id, listing: favorite.listing, favoritedAt: favorite.createdAt },
    });
  } catch (error) {
    logger.error('Error adding favorite:', error);
    next(error);
  }
});

// DELETE /api/users/favorites/:listingId - Remove listing from favorites
router.delete('/favorites/:listingId', async (req, res, next) => {
  try {
    const { listingId } = req.params;

    const favorite = await prisma.userFavorites.findUnique({
      where: { userId_listingId: { userId: req.user.id, listingId } },
    });
    if (!favorite) return res.status(404).json({ error: 'Favorite not found' });

    await prisma.userFavorites.delete({
      where: { userId_listingId: { userId: req.user.id, listingId } },
    });

    res.json({ message: 'Listing removed from favorites' });
  } catch (error) {
    logger.error('Error removing favorite:', error);
    next(error);
  }
});

// ===== INQUIRIES ROUTES =====

// GET /api/users/inquiries - Get user's property inquiries
router.get('/inquiries', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const inquiries = await prisma.inquiry.findMany({
      where: { userId: req.user.id },
      include: {
        listing: {
          include: {
            property: { include: { media: { orderBy: { order: 'asc' }, take: 1 } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    const total = await prisma.inquiry.count({
      where: { userId: req.user.id }
    });

    res.json({
      inquiries,
      pagination: {
        total,
        page,
        currentPage: page, // Add currentPage for frontend compatibility
        pages: Math.ceil(total / limit),
        totalPages: Math.ceil(total / limit), // Add totalPages for frontend compatibility
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching user inquiries:', error);
    next(error);
  }
});

// POST /api/users/inquiries - Create new property inquiry
router.post('/inquiries', validateRequest({ body: createInquirySchema }), async (req, res, next) => {
  try {
    const { listingId, message, contactPreference } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { portal: { select: { slug: true } } },
    });
    if (!user?.portal) return res.status(403).json({ error: 'A portal account is required' });

    const inquiry = await createInquiry({
      portalSlug: user.portal.slug,
      userId: req.user.id,
      listingId,
      message,
      contactPreference,
    });

    enqueueLeadResponse('inquiry', inquiry.id).catch(() => {});

    res.status(201).json({
      message: 'Inquiry submitted successfully',
      inquiry
    });
  } catch (error) {
    if (error instanceof InquiryInputError) return res.status(error.statusCode).json({ error: error.message });
    logger.error('Error creating inquiry:', error);
    next(error);
  }
});

// PUT /api/users/inquiries/:inquiryId - Update inquiry (for agents to respond)
router.put('/inquiries/:inquiryId', requireRole(['AGENT', 'ADMIN']), validateRequest({ body: updateInquirySchema }), async (req, res, next) => {
  try {
    const { inquiryId } = req.params;
    const { agentResponse } = req.body;

    const member = await prisma.accountMember.findFirst({
      where: { userId: req.user.id },
      select: { accountId: true },
    });
    if (!member) return res.status(403).json({ error: 'Owner membership required' });

    const result = await prisma.inquiry.updateMany({
      where: { id: inquiryId, accountId: member.accountId },
      data: { agentResponse, status: 'RESPONDED', respondedAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Inquiry not found' });
    const updatedInquiry = await prisma.inquiry.findFirst({ where: { id: inquiryId, accountId: member.accountId } });

    res.json({
      message: 'Inquiry response submitted successfully',
      inquiry: updatedInquiry
    });
  } catch (error) {
    logger.error('Error updating inquiry:', error);
    next(error);
  }
});

// ===== SAVED SEARCHES ROUTES =====

// GET /api/users/saved-searches - Get user's saved searches
router.get('/saved-searches', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const savedSearches = await prisma.savedSearch.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit
    });

    const total = await prisma.savedSearch.count({
      where: { userId: req.user.id }
    });

    res.json({
      savedSearches,
      pagination: {
        total,
        page,
        currentPage: page,
        pages: Math.ceil(total / limit),
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching saved searches:', error);
    next(error);
  }
});

// GET /api/users/saved-searches/:id - Get a specific saved search
router.get('/saved-searches/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const savedSearch = await prisma.savedSearch.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!savedSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    res.json(savedSearch);
  } catch (error) {
    logger.error('Error fetching saved search:', error);
    next(error);
  }
});

// POST /api/users/saved-searches - Create a new saved search
router.post('/saved-searches', validateRequest({ body: createSavedSearchSchema }), async (req, res, next) => {
  try {
    const { name, criteria } = req.body;

    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId: req.user.id,
        name,
        criteria
      }
    });

    res.status(201).json({
      message: 'Search saved successfully',
      savedSearch
    });
  } catch (error) {
    logger.error('Error creating saved search:', error);
    next(error);
  }
});

// PUT /api/users/saved-searches/:id - Update a saved search
router.put('/saved-searches/:id', validateRequest({ body: updateSavedSearchSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, criteria } = req.body;

    // Verify ownership
    const existingSearch = await prisma.savedSearch.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!existingSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    const updateData: Prisma.SavedSearchUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (criteria !== undefined) updateData.criteria = criteria;

    const savedSearch = await prisma.savedSearch.update({
      where: { id },
      data: updateData
    });

    res.json({
      message: 'Saved search updated successfully',
      savedSearch
    });
  } catch (error) {
    logger.error('Error updating saved search:', error);
    next(error);
  }
});

// DELETE /api/users/saved-searches/:id - Delete a saved search
router.delete('/saved-searches/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existingSearch = await prisma.savedSearch.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!existingSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    await prisma.savedSearch.delete({
      where: { id }
    });

    res.json({ message: 'Saved search deleted successfully' });
  } catch (error) {
    logger.error('Error deleting saved search:', error);
    next(error);
  }
});

// POST /api/users/saved-searches/:id/run - Run a saved search and update result count
router.post('/saved-searches/:id/run', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const savedSearch = await prisma.savedSearch.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!savedSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    // Build the where clause from criteria (same logic as propertyService.getProperties)
    const criteria = savedSearch.criteria as Record<string, any>;
    const where: Prisma.PropertyWhereInput = {};

    if (criteria.city) where.city = { contains: criteria.city, mode: 'insensitive' };
    if (criteria.state) where.state = { contains: criteria.state, mode: 'insensitive' };
    if (criteria.propertyTypes?.length) {
      where.OR = criteria.propertyTypes.map((value) => ({ propertyType: value }));
    } else if (criteria.propertyType) {
      where.propertyType = criteria.propertyType;
    }
    if (criteria.status) where.listings = { some: { status: String(criteria.status).toUpperCase() as any } };
    if (criteria.bedroomsRange && Array.isArray(criteria.bedroomsRange)) {
      where.bedrooms = {};
      if (criteria.bedroomsRange[0] > 0) where.bedrooms.gte = criteria.bedroomsRange[0];
      if (criteria.bedroomsRange[1] < 5) where.bedrooms.lte = criteria.bedroomsRange[1];
      if (Object.keys(where.bedrooms).length === 0) delete where.bedrooms;
    } else if (criteria.bedrooms) {
      where.bedrooms = { gte: parseInt(criteria.bedrooms) };
    }
    if (criteria.bathroomsRange && Array.isArray(criteria.bathroomsRange)) {
      where.bathrooms = {};
      if (criteria.bathroomsRange[0] > 0) where.bathrooms.gte = criteria.bathroomsRange[0];
      if (criteria.bathroomsRange[1] < 4) where.bathrooms.lte = criteria.bathroomsRange[1];
      if (Object.keys(where.bathrooms).length === 0) delete where.bathrooms;
    } else if (criteria.bathrooms) {
      where.bathrooms = { gte: parseFloat(criteria.bathrooms) };
    }

    // Handle price range
    if (criteria.priceRange && Array.isArray(criteria.priceRange)) {
      const listPrice: NonNullable<Prisma.ListingWhereInput['listPrice']> = {};
      if (criteria.priceRange[0] > 0) listPrice.gte = criteria.priceRange[0];
      if (criteria.priceRange[1] < 5000000) listPrice.lte = criteria.priceRange[1];
      if (Object.keys(listPrice).length) where.listings = { some: { ...(where.listings?.some ?? {}), listPrice } };
    }

    // Handle sqFt range
    if (criteria.sqFtRange && Array.isArray(criteria.sqFtRange)) {
      where.squareFeet = {};
      if (criteria.sqFtRange[0] > 0) where.squareFeet.gte = criteria.sqFtRange[0];
      if (criteria.sqFtRange[1] < 10000) where.squareFeet.lte = criteria.sqFtRange[1];
      if (Object.keys(where.squareFeet).length === 0) delete where.squareFeet;
    }

    // Handle year built
    if (criteria.yearBuiltRange && Array.isArray(criteria.yearBuiltRange)) {
      where.yearBuilt = {};
      if (criteria.yearBuiltRange[0] > 1900) where.yearBuilt.gte = criteria.yearBuiltRange[0];
      if (criteria.yearBuiltRange[1] < new Date().getFullYear()) where.yearBuilt.lte = criteria.yearBuiltRange[1];
      if (Object.keys(where.yearBuilt).length === 0) delete where.yearBuilt;
    } else if (criteria.yearBuilt) {
      where.yearBuilt = { gte: parseInt(criteria.yearBuilt) };
    }

    // Get result count
    const resultCount = await prisma.property.count({ where });

    // Update the saved search with last run time and result count
    const updatedSearch = await prisma.savedSearch.update({
      where: { id },
      data: {
        lastRunAt: new Date(),
        resultCount
      }
    });

    res.json({
      savedSearch: updatedSearch,
      resultCount
    });
  } catch (error) {
    logger.error('Error running saved search:', error);
    next(error);
  }
});

// ===== ADMIN ROUTES =====

// GET /api/users - Get all users (admin only)
router.get('/', requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            favorites: true,
            inquiries: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    const total = await prisma.user.count();

    res.json({
      users,
      pagination: {
        total,
        page,
        currentPage: page, // Add currentPage for frontend compatibility
        pages: Math.ceil(total / limit),
        totalPages: Math.ceil(total / limit), // Add totalPages for frontend compatibility
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    next(error);
  }
});

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, role, phoneNumber } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email: email?.toLowerCase(),
        role,
        phoneNumber
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    logger.error('Error updating user:', error);
    next(error);
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting user:', error);
    next(error);
  }
});

export default router;
