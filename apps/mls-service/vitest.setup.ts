import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

// Load the dedicated test-DB config (realestategear_test) before any module reads
// DATABASE_URL — the lazy `db` prisma client picks it up on first query.
// `override: true` ensures .env.test wins even if DATABASE_URL is already set in the
// environment (dotenv does NOT override by default).
const setupDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(setupDir, '.env.test'), override: true });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';

// Hard safety guard: integration tests TRUNCATE tables. Refuse to run unless
// DATABASE_URL targets the throwaway test database — so a stray env var can never
// point the suite at realestategear_dev or production.
if (!/\brealestategear_test\b/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL must target realestategear_test, got "${process.env.DATABASE_URL ?? '(unset)'}"`,
  );
}
