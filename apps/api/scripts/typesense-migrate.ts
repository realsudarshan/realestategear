// One-shot Typesense schema migration. Run BEFORE deploying code that depends
// on new fields. Idempotent: re-runs with no schema delta are no-ops.
//
// Why this lives as a deploy-time script and NOT in ensureCollections():
//   /autoplan eng dual voices flagged the alter-at-boot pattern as unsafe.
//   Multiple API replicas booting in parallel would race on the alter call;
//   Typesense doesn't have idempotent ADD COLUMN semantics across concurrent
//   requests (partial-success can leave the collection in a broken state).
//   Solution: a one-shot script gated by a PostgreSQL advisory lock so only
//   one process ever runs the alter, regardless of how many replicas are
//   spinning up at deploy time.
//
// Usage:
//   npm run typesense:migrate
//
// Exit codes:
//   0  — success (alters applied or none needed)
//   1  — Typesense error or lock-holder timeout
//   2  — DB connection error
//
// Deploy pipeline order:
//   1. npx prisma migrate deploy           (additive nullable columns)
//   2. npm run typesense:migrate           (this script — gated by advisory lock)
//   3. deploy code                         (new readers expect the new schema)
//   4. POST /api/admin/search/reindex/properties  (backfill the new fields)

import { prisma } from 'db';
import client from 'search/typesenseClient';
import { SCHEMAS } from 'search/collections';
import { reindexAll, toContactDoc, toTaskDoc, toTransactionDoc } from 'search';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

// Match the API server: load shared root env first, then API-local overrides.
dotenv.config({ path: join(projectRoot, '.env') });
dotenv.config({ path: join(__dirname, '../.env'), override: true });

// Arbitrary stable 32-bit constant; pg_try_advisory_lock takes a bigint key.
// Different from any other advisory lock in the codebase (grep for
// pg_try_advisory_lock to verify uniqueness before reusing).
const ADVISORY_LOCK_KEY = 7459001;

async function acquireLock(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Set it in the repo root .env, apps/api/.env, or the command environment.');
  }

  const rows = await prisma.$queryRawUnsafe<{ pg_try_advisory_lock: boolean }[]>(
    `SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY})`
  );
  return rows[0]?.pg_try_advisory_lock === true;
}

async function releaseLock(): Promise<void> {
  await prisma
    .$queryRawUnsafe(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`)
    .catch(() => {
      // Release-failure on a script that's about to exit is non-fatal —
      // the lock auto-releases when the connection closes anyway.
    });
}

interface TypesenseField {
  name: string;
  type: string;
  facet?: boolean;
  optional?: boolean;
}

interface TypesenseCollection {
  name: string;
  fields: TypesenseField[];
}

async function reindexCollection(collection: string): Promise<boolean> {
  switch (collection) {
    case 'contacts':
      await reindexAll('contacts', async () => {
        const rows = await prisma.contact.findMany();
        return rows.map(toContactDoc);
      });
      return true;
    case 'transactions':
      await reindexAll('transactions', async () => {
        const rows = await prisma.transaction.findMany({
          include: {
            parties: { include: { contact: { select: { firstName: true, lastName: true } } } },
          },
        });
        return rows.map(toTransactionDoc);
      });
      return true;
    case 'tasks':
      await reindexAll('tasks', async () => {
        const rows = await prisma.task.findMany();
        return rows.map(toTaskDoc);
      });
      return true;
    default:
      return false;
  }
}

async function migrateCollection(schema: { name: string; fields: readonly TypesenseField[] }): Promise<{
  collection: string;
  status: 'missing' | 'altered' | 'no-op';
  addedFields: string[];
  updatedFields: string[];
  reindexed: boolean;
}> {
  let live: TypesenseCollection;
  try {
    live = (await client.collections(schema.name).retrieve()) as TypesenseCollection;
  } catch (err: any) {
    // 404 = collection doesn't exist yet. ensureCollections() in the API
    // boot path will create it from scratch (using the latest schema) on
    // first start. This script only handles existing collections.
    if (err?.httpStatus === 404 || /not found/i.test(err?.message ?? '')) {
      return { collection: schema.name, status: 'missing', addedFields: [], updatedFields: [], reindexed: false };
    }
    throw err;
  }

  const liveFieldNames = new Set(live.fields.map((f) => f.name));
  const missing = schema.fields.filter((f) => !liveFieldNames.has(f.name));
  const byName = new Map(live.fields.map((f) => [f.name, f]));
  const changed = schema.fields.filter((f) => {
    const current = byName.get(f.name);
    if (!current) return false;
    return Boolean(current.facet) !== Boolean(f.facet);
  });

  if (missing.length === 0 && changed.length === 0) {
    return { collection: schema.name, status: 'no-op', addedFields: [], updatedFields: [], reindexed: false };
  }

  // Only add optional fields. Required-field additions to a populated
  // collection would orphan existing docs; if you need a required field,
  // use a versioned collection + alias swap instead (out of scope here).
  const nonOptional = missing.filter((f) => !f.optional);
  if (nonOptional.length > 0) {
    throw new Error(
      `Refusing to add non-optional fields to existing collection "${schema.name}": ${nonOptional
        .map((f) => f.name)
        .join(', ')}. Use a versioned collection + alias swap.`
    );
  }

  if (missing.length > 0) {
    await client.collections(schema.name).update({ fields: missing as any });
  }

  if (changed.length > 0) {
    // Typesense cannot toggle `facet` in place. Drop/re-add the field, then
    // reimport docs from Postgres so the field values are restored immediately.
    await client.collections(schema.name).update({
      fields: changed.map((f) => ({ name: f.name, drop: true })) as any,
    });
    await client.collections(schema.name).update({ fields: changed as any });
  }

  const reindexed = changed.length > 0 ? await reindexCollection(schema.name) : false;

  return {
    collection: schema.name,
    status: 'altered',
    addedFields: missing.map((f) => f.name),
    updatedFields: changed.map((f) => f.name),
    reindexed,
  };
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(`[typesense-migrate] ${msg}`);

  let lockAcquired = false;
  try {
    lockAcquired = await acquireLock();
  } catch (err) {
    log(`Failed to connect to Postgres for advisory lock: ${(err as Error).message}`);
    await prisma.$disconnect().catch(() => {});
    process.exit(2);
  }

  if (!lockAcquired) {
    log('Another replica is running the migration — exiting cleanly.');
    await prisma.$disconnect();
    process.exit(0);
  }

  log(`Lock acquired (key=${ADVISORY_LOCK_KEY}). Inspecting Typesense collections...`);

  let hadAlter = false;
  try {
    for (const schema of SCHEMAS) {
      const result = await migrateCollection(schema);
      switch (result.status) {
        case 'missing':
          log(`${schema.name}: collection does not exist yet — will be created on API boot.`);
          break;
        case 'no-op':
          log(`${schema.name}: schema in sync, no changes needed.`);
          break;
        case 'altered':
          hadAlter = true;
          log(
            `${schema.name}: added fields [${result.addedFields.join(', ')}], updated fields [${result.updatedFields.join(', ')}]${result.reindexed ? ', reindexed' : ''}.`,
          );
          break;
      }
    }
    log(hadAlter ? 'Migration complete.' : 'No schema deltas. Nothing to do.');
    await releaseLock();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    log(`ERROR: ${(err as Error).message}`);
    await releaseLock();
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[typesense-migrate] Unhandled error:', err);
  process.exit(1);
});
