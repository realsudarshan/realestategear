import { config as loadEnv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, env } from 'prisma/config';

// Prisma runs from packages/db, so `dotenv/config` (cwd-relative) never sees the
// monorepo-root .env the README tells you to create. Load the root .env first
// (shared vars like DATABASE_URL), then an optional packages/db/.env override.
// A real DATABASE_URL already in the environment (e.g. CI) still wins — dotenv
// does not override existing vars unless override:true, which we scope to the
// local file that does not exist in CI.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(here, '../../.env') });
loadEnv({ path: join(here, '.env'), override: true });

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
