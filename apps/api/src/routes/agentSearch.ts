import { Router } from 'express';
import { prisma } from 'db';
import { requireRole } from '../middleware/auth.js';
import {
  isTypesenseConfigured,
  searchContactsPg,
  searchDocuments,
  searchPropertiesPg,
  searchTasksPg,
  searchTransactionsPg,
} from '../search/index.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

interface CollectionResult {
  items: unknown[];
  total: number;
}

// GET /api/agent/search?q=&limit= — unified search powering the cmd-k palette.
// Always returns items + total for every scope so the palette can render pill counts in
// one round trip. Scoping: contacts/transactions by accountId, tasks by assignee, properties
// are the shared MLS catalog (no scope). Inquiries are not indexed — the palette fetches
// those separately from /api/agent/inquiries.
//
// Backed by Typesense when TYPESENSE_HOST is set. When it isn't (self-hosters
// who skip Typesense) or a Typesense call throws, falls back to the Postgres
// ILIKE equivalents in packages/search/postgresFallback.ts — real results
// instead of a silently-empty palette.
router.get('/', async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 8;
    const perPage = Math.min(Number.isFinite(limit) ? limit : 8, 50);

    const member = await prisma.accountMember.findFirst({ where: { userId } });
    const accountId = member?.accountId;

    const empty = { items: [], total: 0 };
    if (!accountId) {
      return res.json({ contacts: empty, transactions: empty, properties: empty, tasks: empty });
    }

    const searchTypesense = (collection: string, filterBy?: string) =>
      searchDocuments(collection, { q: q || '*', filterBy, perPage }).then((r) => ({
        items: (r.hits ?? []).map((h) => h.document),
        total: r.found ?? 0,
      }));

    const withFallback = (
      collection: string,
      typesense: () => Promise<CollectionResult>,
      postgres: () => Promise<CollectionResult>,
    ): Promise<CollectionResult> => {
      if (!isTypesenseConfigured()) return postgres();
      return typesense().catch((error) => {
        logger.warn(`Typesense search failed for "${collection}", falling back to Postgres`, { error });
        return postgres();
      });
    };

    const [contacts, transactions, properties, tasks] = await Promise.all([
      withFallback(
        'contacts',
        () => searchTypesense('contacts', `accountId:=${accountId}`),
        () => searchContactsPg({ accountId, q, limit: perPage }),
      ),
      withFallback(
        'transactions',
        () => searchTypesense('transactions', `accountId:=${accountId}`),
        () => searchTransactionsPg({ accountId, q, limit: perPage }),
      ),
      withFallback(
        'properties',
        () => searchTypesense('properties', undefined),
        () => searchPropertiesPg({ q, limit: perPage }),
      ),
      withFallback(
        'tasks',
        () => searchTypesense('tasks', `assignedToId:=${userId}`),
        () => searchTasksPg({ assignedToId: userId, q, limit: perPage }),
      ),
    ]);

    res.json({ contacts, transactions, properties, tasks });
  } catch (error) {
    next(error);
  }
});

export default router;
