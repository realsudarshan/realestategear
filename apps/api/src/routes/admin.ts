import express from 'express';
import { ListingStatus, Prisma, prisma } from 'db';
import { requireRole } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { cacheAdminStats, invalidateAdminCache } from '../middleware/cache.js';

const router = express.Router();

// All admin routes require admin role
router.use(requireRole(['admin']));

// GET /api/admin/stats - Get dashboard statistics
router.get('/stats', cacheAdminStats, async (req, res, next) => {
  try {
    const [
      totalProperties,
      activeProperties,
      soldProperties,
      totalMedia
    ] = await Promise.all([
      prisma.property.count(),
      prisma.listing.count({ where: { status: 'ACTIVE' } }),
      prisma.listing.count({ where: { status: 'SOLD' } }),
      prisma.media.count()
    ]);

    const recentProperties = await prisma.property.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        address: true,
        city: true,
        createdAt: true,
        listings: {
          orderBy: { listDate: 'desc' },
          take: 1,
          select: { listPrice: true, status: true },
        },
      }
    });

    res.json({
      stats: {
        totalProperties,
        activeProperties,
        soldProperties,
        totalMedia
      },
      recentProperties: recentProperties.map((property) => ({
        ...property,
        price: property.listings[0]?.listPrice ?? null,
        status: property.listings[0]?.status ?? null,
        listings: undefined,
      }))
    });
  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    next(error);
  }
});

// GET /api/admin/properties - Get all properties with admin view
router.get('/properties', async (req, res, next) => {
  try {
    const { page = '1', limit = '50', status, search } = req.query as Record<string, string | undefined>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Prisma.PropertyWhereInput = {};
    if (status) where.listings = { some: { status: status.toUpperCase() as ListingStatus } };
    if (search) {
      where.OR = [
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { listings: { some: { mlsId: { contains: search, mode: 'insensitive' } } } }
      ];
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' },
        include: {
          media: {
            take: 1,
            orderBy: { order: 'asc' }
          },
          _count: {
            select: { media: true }
          }
        }
      }),
      prisma.property.count({ where })
    ]);

    res.json({
      properties,
      pagination: {
        page: parseInt(page),
        currentPage: parseInt(page), // Add currentPage for frontend compatibility
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        totalPages: Math.ceil(total / parseInt(limit)) // Add totalPages for frontend compatibility
      }
    });
  } catch (error) {
    logger.error('Error fetching admin properties:', error);
    next(error);
  }
});

// PUT /api/admin/properties/:id/status - Update property status
router.put('/properties/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await prisma.listing.updateMany({
      where: { propertyId: id },
      data: { status: String(status).toUpperCase() as ListingStatus },
    });

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        media: {
          orderBy: { order: 'asc' }
        },
        listings: { orderBy: { listDate: 'desc' }, take: 1 }
      }
    });

    if (!property) return res.status(404).json({ error: 'Property not found' });

    res.json(property);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Property not found' });
    }
    logger.error('Error updating property status:', error);
    next(error);
  }
});

// POST /api/admin/bulk-import - Bulk import properties
router.post('/bulk-import', async (req, res, next) => {
  try {
    const { properties } = req.body;

    if (!Array.isArray(properties)) {
      return res.status(400).json({ error: 'Properties must be an array' });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const propertyData of properties) {
      try {
        if (propertyData.parcelId) {
          await prisma.property.upsert({
            where: { parcelId: propertyData.parcelId },
            create: propertyData,
            update: propertyData,
          });
        } else {
          await prisma.property.create({ data: propertyData });
        }

        results.created++;
      } catch (error) {
        results.errors.push({
          mlsId: propertyData.mlsId,
          error: error.message
        });
      }
    }

    res.json(results);
  } catch (error) {
    logger.error('Error bulk importing properties:', error);
    next(error);
  }
});

export default router;
