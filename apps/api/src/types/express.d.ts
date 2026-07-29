import type { JwtPayload } from 'jsonwebtoken';

export type AuthUser = JwtPayload & {
  id: string;
  email?: string;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  accountId?: string | null;
  portalId?: string | null;
  avatarUrl?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser | null;
    }
  }
}
