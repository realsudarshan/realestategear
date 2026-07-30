# mls-service

Syncs real estate listing data from a RESO Web API MLS vendor (MLS Grid,
Trestle, Bridge Interactive, Spark API, or any other RESO Web API-compliant
provider) into the shared Postgres database. A data-tier backend worker — it
reads/writes Postgres directly via `db`, not through `apps/api`.

For the full self-hoster walkthrough — getting vendor credentials,
discovering your board's ID prefix, configuring env vars, adding a
compliance policy entry — see
**[docs/MLS_BOARD_SETUP.md](../../docs/MLS_BOARD_SETUP.md)**.

## Architecture

- **`src/connectors/reso/ResoWebApiConnector.ts`** — the connector. Works
  against any RESO Web API vendor: OData `$filter`/`$expand`/`$top` query
  building, `@odata.nextLink` pagination streamed page-by-page, exponential
  backoff on 5xx (never retries 4xx). Board-scope filter, viewable-flag
  field, and auth are all injected as config, not hardcoded to one vendor.
- **`src/connectors/reso/auth/`** — the two confirmed real auth shapes:
  `StaticBearerTokenAuth` (a long-lived token, e.g. MLS Grid) and
  `OAuth2ClientCredentialsAuth` (client id/secret exchanged for a token that
  expires and refreshes itself, e.g. Trestle/Bridge/Spark).
- **`src/config/mls.ts`** — env-var-driven config (no parallel JSON
  config file, so the compiler catches
  typos a JSON file wouldn't). Returns `null` when `MLS_AUTH_TYPE` is unset
  so the service boots idle; throws at startup for a half-configured setup
  (credentials present but no board declared) rather than silently syncing
  the wrong thing.
- **`src/sync/runSync.ts`** — the orchestrator: dead-letter retry, in-process
  overlap lock, per-run metrics, the `MLS_SYNC_ENABLED` kill-switch.
- **`src/sync/persistence.ts`** — upserts `Property`/`Listing`; the
  `MLS_PUBLIC_DISPLAY_ENABLED` worker setting controls media and search-index
  writes. It is not a complete API read gate; see
  [docs/MLS_COMPLIANCE.md](../../docs/MLS_COMPLIANCE.md).
- **`src/sync/roster.ts`** — Member/Office roster sync, consumed by
  `apps/api`'s agent MLS verification flow.
- **`src/sync/media.ts`** — photo download/re-hosting. Currently MLS-Grid-
  specific (its no-hotlink rule requires the access token as the download
  `User-Agent`) — only runs for static-auth vendors with storage configured;
  skipped otherwise.
- **`scripts/sample-pull.ts`** (`npm run sample-pull`) — read-only diagnostic:
  pulls a small sample from your configured vendor and reports the things
  you need to confirm before syncing for real (ID prefix, field completeness,
  distinct status values).

## Scheduling

Hardcoded in `src/index.ts`: Property incremental every 10 minutes, full
reconcile nightly at 2am, Member/Office roster daily at 3am.

## Local development

```bash
cp .env.example .env   # fill in DATABASE_URL at minimum
npm run dev --workspace=@realestategear/mls-service
```

Boots idle with a warning if `MLS_AUTH_TYPE` is unset — no MLS vendor is
required to run the rest of the stack locally.

## Deployment

Build context must be the **monorepo root** (this app depends on the
workspace `db` and `search` packages):

```bash
docker build -f apps/mls-service/Dockerfile -t realestategear/mls-service .
```

Provide `DATABASE_URL` and the MLS env vars from `.env.example` at runtime.
