/**
 * Guards a redirect target against open-redirect via a `?from=` query param.
 *
 * A plain `startsWith("//")` check isn't enough: browsers resolve a leading
 * `/\`, `\/`, or `\\` the same way as `//` per the WHATWG URL spec (backslash
 * is a path/authority separator for special schemes), so `/\evil.com` also
 * escapes to a different origin. Resolve against a placeholder origin and
 * require the result to still be on that origin — this closes every
 * separator-combination bypass instead of enumerating them one at a time.
 */
export function safePath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/")) return "/";
  const base = "http://portal-safe-path.invalid";
  try {
    const resolved = new URL(path, base);
    if (resolved.origin !== base) return "/";
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return "/";
  }
}
