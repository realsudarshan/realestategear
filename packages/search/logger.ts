/**
 * Minimal logger for the shared `search` package.
 *
 * The package is imported by both `apps/api` (winston) and `apps/mls-service`
 * (winston), each with its own logger. To stay decoupled from either, the
 * package logs through console with a `[search]` prefix. Swap for an injected
 * logger if richer transport is ever needed.
 */
export const logger = {
  info: (...args: unknown[]) => console.info('[search]', ...args),
  warn: (...args: unknown[]) => console.warn('[search]', ...args),
  error: (...args: unknown[]) => console.error('[search]', ...args),
};

export default logger;
