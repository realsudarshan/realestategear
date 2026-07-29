/**
 * One-shot diagnostic: pull a small sample of Property records from your
 * configured RESO Web API vendor (MLS Grid, Trestle, Bridge, Spark, etc.) and
 * report the things a self-hoster needs to confirm before syncing for real:
 *   - the board PREFIX on ListingKey / ListingId / parcel (decision D17)
 *   - ParcelNumber fill rate (decision D11 — parcel-anchor vs listing fallback)
 *   - distinct StandardStatus values (decision D10 — status map coverage)
 *   - UnitNumber presence (Codex #11 — multi-unit guard relevance)
 *
 * Read-only. No DB writes. Requires MLS_AUTH_TYPE + the matching credentials
 * (see docs/MLS_BOARD_SETUP.md).
 *   npm run sample-pull
 */
import { loadMlsConfig } from '../src/config/mls.js';
import { ResoWebApiConnector } from '../src/connectors/reso/ResoWebApiConnector.js';
import type { ResoPropertyRecord } from '../src/connectors/reso/types.js';
import { str } from '../src/sync/coerce.js';

const SAMPLE_SIZE = 100;

/** Longest common leading run of non-digits across values (a prefix guess). */
function guessPrefix(values: string[]): string {
  const leads = values
    .map((v) => v.match(/^[^0-9]+/)?.[0] ?? '')
    .filter((s) => s.length > 0);
  if (!leads.length) return '(none — values start with a digit)';
  let prefix = leads[0];
  for (const lead of leads) {
    while (prefix && !lead.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) break;
  }
  return prefix || '(no common prefix)';
}

function pct(part: number, total: number): string {
  return total ? `${Math.round((part / total) * 100)}%` : 'n/a';
}

function report(records: ResoPropertyRecord[]): void {
  const n = records.length;
  const listingKeys = records.map((r) => str(r.ListingKey) ?? '').filter(Boolean);
  const listingIds = records.map((r) => str(r.ListingId) ?? '').filter(Boolean);
  const withParcel = records.filter((r) => str(r.ParcelNumber)).length;
  const withUnit = records.filter((r) => str((r as Record<string, unknown>).UnitNumber)).length;
  const statuses = [...new Set(records.map((r) => str(r.StandardStatus)).filter(Boolean))].sort();

  console.log(`\n=== MLS sample report (${n} Property records) ===\n`);
  console.log('PREFIX (D17):');
  console.log(`  ListingKey prefix guess : ${guessPrefix(listingKeys)}`);
  console.log(`  ListingId  prefix guess : ${guessPrefix(listingIds)}`);
  console.log(`  sample ListingKey       : ${listingKeys.slice(0, 3).join(', ') || '(none)'}`);
  console.log(`  sample ListingId        : ${listingIds.slice(0, 3).join(', ') || '(none)'}`);
  console.log('\nPARCEL (D11):');
  console.log(`  ParcelNumber present    : ${withParcel}/${n} (${pct(withParcel, n)})`);
  console.log(`  UnitNumber present      : ${withUnit}/${n} (${pct(withUnit, n)})  [multi-unit guard]`);
  console.log('\nSTATUS (D10):');
  console.log(`  distinct StandardStatus : ${statuses.join(', ') || '(none)'}`);
  console.log('\nFIELDS on first record:');
  console.log(`  ${Object.keys(records[0] ?? {}).sort().join(', ')}`);
  console.log('\n(Use these to set MLS_PREFIX, confirm the parcel-anchor path, and extend the status map.)\n');
}

async function main(): Promise<void> {
  const settings = loadMlsConfig();
  if (!settings) {
    console.error('MLS_AUTH_TYPE not set. Configure your vendor credentials first — see docs/MLS_BOARD_SETUP.md.');
    process.exit(1);
  }

  const connector = new ResoWebApiConnector({ ...settings.connector, pageSize: SAMPLE_SIZE });
  console.log(
    `Pulling up to ${SAMPLE_SIZE} Property records from ${settings.connector.baseUrl} ` +
      `(board=${settings.sync.mlsBoardId})…`,
  );

  let firstPage: ResoPropertyRecord[] = [];
  for await (const page of connector.fetchResource<ResoPropertyRecord>('Property', {
    requireViewable: true,
  })) {
    firstPage = page;
    break; // sample = first page only
  }

  if (!firstPage.length) {
    console.log('No records returned for this board/filter.');
    return;
  }
  report(firstPage);
}

main().catch((err) => {
  console.error('sample-pull failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
