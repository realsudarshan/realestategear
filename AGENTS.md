# Real Estate Gear Agent Notes

## Current Operational Boundary

- Use Node `22.12.0` and npm workspaces. Do not use pnpm or yarn.
- Treat `apps/portal` as the default public frontend. Root `npm run dev` and `npm start` run the portal with `apps/api`.
- The current core runtime is portal + API + PostgreSQL. PostgreSQL is required; Redis and Typesense are optional.
- `apps/mls-service` is the included MLS worker and runs as a separate process. Without MLS credentials it can remain dormant.
- `/api/agent/*` is fail-closed unless `AGENT_API_ENABLED=true`; examples and deployments must keep `AGENT_API_ENABLED=false` by default.
- Agent HQ, internal admin, marketing, and client-specific portals live in separate private repositories. Do not add private product source back to this public core.
- Keep current-state documentation separate from [the Clean Core roadmap](./docs/REALESTATEGEAR_OSS_ROADMAP.md).

## Commands

- Install with `npm install` or `npm ci`; `package-lock.json` is the lockfile.
- Default development: `npm run dev` or `npm run dev:portal`.
- Focused development: `npm run dev:api`, `npm run dev --workspace=portal`, and `npm run dev --workspace=@realestategear/mls-service`.
- Build the API deployment prerequisite with `npm run build:api`; build the portal with `npm run build --workspace=portal`.
- Apply existing migrations with `npm run db:migrate`. Generate Prisma client after schema changes with `npm run build --workspace=db`.
- Verify focused changes with `npm run test:api`, `npm run test:portal`, and the relevant `npm run typecheck:<workspace>` command.
- MLS tests: `npm run test --workspace=@realestategear/mls-service`.

## Database And Demo Data

- Prisma files live in `packages/db`; the datasource is PostgreSQL for development and production.
- Demo and destructive seeds require `CONFIRM_DEMO_SEED` to exactly match `<host>:<port>/<database>` from `DATABASE_URL` and refuse to run when `NODE_ENV=production`.
- Guarded reset commands are `npm run db:demo:reset`, `npm run db:demo:reset:1000`, `npm run db:demo:reset:agent`, and `npm run db:demo:reset-and-seed`.
- Portal demo provisioning uses `npm run db:seed:portal`; optional portal listings use `npm run db:seed:demo-listings`. These are guarded too.
- Never add automatic production seeding, fixed credentials, or a production `CONFIRM_DEMO_SEED` variable.
- Railway internal PostgreSQL hostnames resolve only inside Railway. From a workstation, use the Postgres service's public URL without committing or logging it.

## App And Environment Notes

- Portal: <http://localhost:3006>. API: <http://localhost:3001>.
- `apps/portal` rewrites same-origin `/api/:path*` requests to `NEXT_PUBLIC_API_URL` or the local API fallback. Authenticated portal requests use its server-side proxy and httpOnly session cookie.
- `FRONTEND_URL` is the canonical portal origin used by the API for links and callbacks. Local examples must use port 3006.
- API-specific variables belong in `apps/api/.env` or the API service environment.
- Leave `TYPESENSE_HOST` unset for PostgreSQL search. Leave `REDIS_URL` unset to run without Redis.
- Deployment domains should point directly at the root of `apps/portal`.

## Design System

- Read root `DESIGN.md` before UI work.
- Prefer shared components in `packages/ui` and tokens in `packages/tokens` over app-local duplication.
- Keep the established compact soft-brutalist language: Geist, visible borders, small radii, restrained motion, and semantic tokens.
