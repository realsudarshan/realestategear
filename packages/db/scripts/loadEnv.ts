import { config as loadEnv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Side-effect module: import this instead of 'dotenv/config' in anything under
// packages/db that runs as its own process (seeds, backfills, guards).
//
// `dotenv/config` resolves .env against the current working directory. These
// scripts run via `npm run ... --workspace=db`, so cwd is packages/db and the
// monorepo-root .env that the README Quick Start tells you to create is never
// read — DATABASE_URL comes back undefined.
//
// Load the root .env first (shared vars), then an optional packages/db/.env
// override. A DATABASE_URL already present in the environment (CI, or an
// explicit one-off) still wins: dotenv does not overwrite existing variables
// unless override is set, which is scoped to the local file that does not
// exist in CI.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(here, '../../../.env') });
loadEnv({ path: join(here, '../.env'), override: true });
