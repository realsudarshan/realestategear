# Real Estate Gear API

Express 5 API for authentication, portal and property data, inquiries, search, and operational jobs. PostgreSQL is required; Redis and Typesense are optional.

## Requirements

- Node.js `>=22.12.0 <23` (the repository pins `22.12.0`)
- npm workspaces; no exact npm version is pinned
- PostgreSQL with committed migrations applied

Run commands from the repository root.

## Development

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run build --workspace=db
npm run db:migrate
npm run dev:api
```

The API loads the root `.env`, then `apps/api/.env` with API-specific values taking precedence. At minimum configure `DATABASE_URL` and `JWT_SECRET`. The default port is `3001`; override it with `API_PORT`. Set `LOG_LEVEL` to `debug`, `info`, `warn`, `error`, or `silent`.

API startup does not run migrations. Apply them explicitly with `npm run db:migrate` before starting a version that needs schema changes.

## Commands

```bash
npm run dev:api
npm run start:api
npm run test:api
npm run typecheck:api
npm run db:migrate
```

`AGENT_API_ENABLED` defaults to fail-closed behavior; keep it `false` unless a compatible external client is intentionally configured. Set `REDIS_ENABLED=false` and leave `TYPESENSE_HOST` unset to use the PostgreSQL-only baseline.

## Docker And Deployment

Build from the monorepo root:

```bash
docker build -f apps/api/Dockerfile -t realestategear/api .
```

Provide secrets at runtime, not build time. Run `npm run db:migrate` as a separate release step, then start the container. The container command only starts the API.

See [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) for Railway configuration and [`docs/DATABASE.md`](../../docs/DATABASE.md) for migration and seed safety guidance. The health endpoint is `GET /health`.
