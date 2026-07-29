/** Shared coercion helpers for turning loosely-typed RESO field values into
 *  our schema's scalar types. Used by the mappers, persistence, and roster. */

/** A trimmed non-empty string, else undefined. */
export function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** A finite number, else undefined. */
export function num(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** A truncated integer, else undefined. */
export function int(value: unknown): number | undefined {
  const n = num(value);
  return n === undefined ? undefined : Math.trunc(n);
}

/** A valid Date parsed from a string, else undefined. */
export function dateOf(value: unknown): Date | undefined {
  const s = str(value);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
