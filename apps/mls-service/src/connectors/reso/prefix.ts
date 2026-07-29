/**
 * Some RESO Web API vendors (e.g. MLS Grid) prefix every Key and MlsId field
 * with a board-specific prefix (e.g. ListingKey `123456` → `ACT123456` for
 * ACTRIS) to keep IDs unique across boards. Per MLS Grid docs (decision D17):
 * the prefix must be STRIPPED before displaying a value externally, and ADDED
 * BACK whenever requesting a record by that ID (e.g. the live member-
 * verification fallback, D8).
 *
 * We store `listingKey` prefixed (it's the canonical key we re-query with) but
 * store `mlsId`/`MemberMlsId` de-prefixed (they're display values).
 */

/** Remove the board prefix for display. No-op if prefix is empty or absent. */
export function stripPrefix(value: string, prefix: string | undefined): string {
  if (!prefix) return value;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

/** Add the board prefix back before querying by ID. No-op if already prefixed. */
export function addPrefix(value: string, prefix: string | undefined): string {
  if (!prefix) return value;
  return value.startsWith(prefix) ? value : `${prefix}${value}`;
}
