/**
 * Anything with a Headers-like .get() — NextRequest.headers (route handlers)
 * or the ReadonlyHeaders returned by next/headers's headers() (server actions).
 */
type HeaderReader = { get(name: string): string | null };

/**
 * Build outgoing headers for a portal → api proxy call, forwarding the
 * original client IP so the api's express-rate-limit keys on per-visitor IPs
 * rather than this server's container IP.
 */
export function buildProxyHeaders(
  requestHeaders: HeaderReader,
  extra: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };

  const xff = requestHeaders.get("x-forwarded-for");
  const realIp = requestHeaders.get("x-real-ip");
  const cfIp = requestHeaders.get("cf-connecting-ip");

  if (cfIp) {
    headers["X-Forwarded-For"] = cfIp;
  } else if (realIp) {
    headers["X-Forwarded-For"] = realIp;
  } else if (xff) {
    headers["X-Forwarded-For"] = xff;
  }

  return headers;
}
