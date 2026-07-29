import { Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'crypto'

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    console.error('[adminAuth] ADMIN_SECRET env var not set')
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const provided = String(req.headers['x-admin-secret'] ?? '')
  const match =
    provided.length === secret.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
  if (!match) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}
