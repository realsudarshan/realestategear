import express from 'express'
import { prisma } from 'db'
import logger from '../utils/logger.js'

const router = express.Router()

// ─── GET /api/admin/accounts ─────────────────────────────────────────────────
// Returns all accounts with computed health signals.
// Queries are batched to avoid N+1.
router.get('/', async (req, res, next) => {
  try {
    const now = new Date()
    const cutoff14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        portals: {
          select: { id: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Collect all portal IDs across all accounts for batch queries
    const allPortalIds = accounts.flatMap((a) => a.portals.map((p) => p.id))

    // Batch query: recent portal inquiries (visitor leads) — for no_activity signal
    const recentInquiryCounts = await prisma.inquiry.groupBy({
      by: ['portalId'],
      where: {
        portalId: { in: allPortalIds },
        createdAt: { gt: cutoff14d },
      },
      _count: { id: true },
    })
    const recentByPortal = new Map(
      recentInquiryCounts.map((r) => [r.portalId, r._count.id])
    )

    // Batch query: latest inquiry per portal — for lastInquiryAt on the list
    const latestInquiries = await prisma.inquiry.findMany({
      where: { portalId: { in: allPortalIds } },
      select: { portalId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['portalId'],
    })
    const latestByPortal = new Map(
      latestInquiries.map((i) => [i.portalId, i.createdAt])
    )

    // Batch query: 30-day inquiry count per portal — for recentInquiryCount
    const inquiryCounts30d = await prisma.inquiry.groupBy({
      by: ['portalId'],
      where: {
        portalId: { in: allPortalIds },
        createdAt: { gt: cutoff30d },
      },
      _count: { id: true },
    })
    const counts30dByPortal = new Map(
      inquiryCounts30d.map((r) => [r.portalId, r._count.id])
    )

    const result = accounts.map((account) => {
      const portalIds = account.portals.map((p) => p.id)

      // Compute health signals
      const hasRecentActivity = portalIds.some(
        (id) => (recentByPortal.get(id) ?? 0) > 0
      )
      const neverPublished =
        account.portals.length > 0 && !account.portals.some((p) => p.isActive)

      const signals: string[] = []
      if (!hasRecentActivity && portalIds.length > 0) signals.push('no_activity')
      if (neverPublished) signals.push('never_published')

      // Last inquiry across all portals
      let lastInquiryAt: Date | null = null
      for (const id of portalIds) {
        const t = latestByPortal.get(id)
        if (t && (!lastInquiryAt || t > lastInquiryAt)) lastInquiryAt = t
      }

      // Recent inquiry count (30d) across all portals
      const recentInquiryCount = portalIds.reduce(
        (sum, id) => sum + (counts30dByPortal.get(id) ?? 0),
        0
      )

      return {
        id: account.id,
        name: account.name,
        createdAt: account.createdAt,
        portalCount: account.portals.length,
        activePortalCount: account.portals.filter((p) => p.isActive).length,
        lastInquiryAt,
        recentInquiryCount,
        signals,
      }
    })

    res.json(result)
  } catch (error) {
    logger.error('Error fetching admin accounts:', error)
    next(error)
  }
})

// ─── GET /api/admin/accounts/:id ─────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const account = await prisma.account.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        members: {
          select: {
            id: true,
            role: true,
            user: {
              select: { email: true, firstName: true, lastName: true },
            },
          },
        },
        portals: {
          select: { id: true, name: true, slug: true, isActive: true, suspendedAt: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        mlsAccess: {
          select: { mlsBoardId: true, membershipId: true, flaggedInactiveAt: true },
        },
      },
    })

    if (!account) {
      return res.status(404).json({ error: 'Account not found' })
    }

    // Per-portal inquiry count (30d) — acceptable N here (one account at a time)
    const portalsWithCounts = await Promise.all(
      account.portals.map(async (portal) => ({
        ...portal,
        inquiryCount30d: await prisma.inquiry.count({
          where: { portalId: portal.id, createdAt: { gt: cutoff30d } },
        }),
      }))
    )

    res.json({ ...account, portals: portalsWithCounts })
  } catch (error) {
    logger.error('Error fetching admin account detail:', error)
    next(error)
  }
})

// ─── PATCH /api/admin/accounts/:accountId/portals/:portalId/suspend ─────────
// Manual-only action (issue #205) — never called by the mls-status-check
// cron, which only flags AccountMlsAccess. Scoped update (id + accountId) so
// a portalId from another account can't be touched.
router.patch('/:accountId/portals/:portalId/suspend', async (req, res, next) => {
  try {
    const { accountId, portalId } = req.params
    const { suspended } = req.body ?? {}
    if (typeof suspended !== 'boolean') {
      return res.status(400).json({ error: 'suspended must be a boolean' })
    }

    const { count } = await prisma.portal.updateMany({
      where: { id: portalId, accountId },
      data: { suspendedAt: suspended ? new Date() : null },
    })
    if (count === 0) return res.status(404).json({ error: 'Portal not found' })

    const portal = await prisma.portal.findUnique({ where: { id: portalId } })
    res.json(portal)
  } catch (error) {
    logger.error('Error updating portal suspension:', error)
    next(error)
  }
})

export default router
