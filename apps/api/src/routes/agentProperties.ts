import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { searchProperties, getProperties } from '../services/propertyService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

// GET /api/agent/properties?search=&limit= - paginated catalog search (powers cmd-k).
// Returns { properties, pagination } so callers get capped rows plus a real total count.
router.get('/', async (req, res, next) => {
  try {
    const result = await getProperties(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/agent/properties/search?q= - Search properties by MLS ID, address, etc.
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.json([]);
    }
    const properties = await searchProperties(q.trim());
    res.json(properties);
  } catch (error) {
    next(error);
  }
});

export default router;
