import { cookies } from "next/headers";
import { TOKEN_COOKIE_NAME } from "./auth";
import type { SessionUser } from "./session-user";

/**
 * Decode the portal_token cookie's JWT payload and return the user shape the
 * header/favorites page need. Signature verification happens on the api when
 * the token is actually used; here we just need the claims for display.
 *
 * Returns null if no cookie, malformed token, or decode fails — callers
 * should render a logged-out state. Never throws.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const claims = JSON.parse(decoded) as Partial<SessionUser>;
    if (!claims.id || !claims.email || !claims.accountId) return null;
    return {
      id: claims.id,
      email: claims.email,
      firstName: claims.firstName ?? null,
      lastName: claims.lastName ?? null,
      role: claims.role ?? "USER",
      accountId: claims.accountId,
      portalId: claims.portalId ?? null,
      avatarUrl: claims.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}
