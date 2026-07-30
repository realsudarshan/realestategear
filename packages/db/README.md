# Database Package

This workspace contains the PostgreSQL Prisma schema, migrations, generated client configuration, and guarded demo seeds.

Run commands from the repository root with Node.js `>=22.12.0 <23` and npm workspaces. No exact npm version is pinned; installs use the root `package-lock.json`.

## Schema And Migrations

```bash
# Generate Prisma client
npm run build --workspace=db

# Apply committed migrations
npm run db:migrate

# Check migration status
npx prisma migrate status --config=packages/db/prisma.config.ts

# Author a migration against a disposable development database
npx prisma migrate dev --config=packages/db/prisma.config.ts --name <migration-name>
```

API startup does not apply migrations. Run `npm run db:migrate` explicitly during deployment before starting the API.

## Guarded Demo Seeds

Every seed command below requires `DATABASE_URL`, refuses to run when `NODE_ENV=production`, and requires `CONFIRM_DEMO_SEED` to exactly match the parsed `<host>:<port>/<database>` target, including `?schema=...` when present.

For example:

```bash
export DATABASE_URL='postgresql://realestategear:change-me@localhost:5432/realestategear_dev?schema=public'
export CONFIRM_DEMO_SEED='localhost:5432/realestategear_dev?schema=public'
```

Populate portal demo records:

```bash
npm run db:seed:portal
npm run db:seed:demo-listings
```

Populate the 1,000-property demo dataset only when the database has no existing properties or users:

```bash
npm run db:seed:1000
```

Destructive reset commands:

```bash
npm run db:demo:reset
npm run db:demo:reset:1000
npm run db:demo:reset:agent
npm run db:demo:reset-and-seed
```

**Warning:** reset commands delete or replace data. Verify `DATABASE_URL` independently and confirm the target printed by the guard before proceeding. Never set `CONFIRM_DEMO_SEED` in production or add a seed command to application startup.

Demo accounts and credentials are local-only. Seed commands report what they create; do not reuse those credentials in any deployed environment.
