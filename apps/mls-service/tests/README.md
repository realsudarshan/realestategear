# MLS Service Test Suite

The MLS service tests are TypeScript files run by Vitest in its Node environment.

## Requirements

- Node.js `>=22.12.0 <23` and npm, matching the repository root.
- PostgreSQL with a disposable database named `realestategear_test` and all committed migrations applied.

Create `apps/mls-service/.env.test` with a test-only connection URL:

```bash
DATABASE_URL="postgresql://realestategear:change-me@localhost:5432/realestategear_test?schema=public"
```

The setup file overrides any existing `DATABASE_URL` with `.env.test` and refuses to run unless the URL contains `realestategear_test`.

Apply migrations to that database before running the suite:

```bash
DATABASE_URL="postgresql://realestategear:change-me@localhost:5432/realestategear_test?schema=public" npm run db:migrate
```

## Running Tests

```bash
npm run test --workspace=@realestategear/mls-service
npm run test:watch --workspace=@realestategear/mls-service
npm run test:coverage --workspace=@realestategear/mls-service
```

Run a directory, file, or matching test name by passing Vitest arguments:

```bash
npm run test --workspace=@realestategear/mls-service -- tests/unit
npm run test --workspace=@realestategear/mls-service -- tests/unit/config/mls.test.ts
npm run test --workspace=@realestategear/mls-service -- -t "loads a full MLS-Grid-shaped static config"
```

## Structure And Safety

- `tests/unit/**/*.test.ts` covers configuration, RESO connectors and auth, sync helpers, persistence helpers, and storage behavior. Some unit files mock the `db` or `search` workspaces.
- `tests/integration/**/*.integration.test.ts` exercises persistence, media, and sync orchestration against PostgreSQL.
- Integration tests issue `TRUNCATE ... CASCADE` against shared tables and run test files sequentially to avoid truncation races.

Never point `.env.test` at a development, staging, or production database. The `realestategear_test` name check is a final guard, not permission to reuse a database containing valuable data.
