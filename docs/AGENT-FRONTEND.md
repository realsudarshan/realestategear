# Agent frontend

This guide describes the Agent workspace in `apps/portal`, its API
dependencies, and the local and production configuration required to run it.
The Agent API is an opt-in surface: deployments must explicitly enable it.

## Local setup

Use Node.js `>=22.12.0 <23` and npm. PostgreSQL is required. Redis, Typesense,
MLS synchronization, object storage, Google Workspace, and OpenAI are optional.

From the repository root:

```bash
npm install
```

Copy the root `.env.example` to `.env`, then copy
`apps/api/.env.example` to `apps/api/.env` if API-specific overrides are
needed. The API loads the root environment and then the API environment, with
API-specific values taking precedence.

Apply migrations before starting the API:

```bash
npm run build --workspace=db
npm run db:migrate
```

The portal is available at <http://localhost:3006> and the API at
<http://localhost:3001>.

## Required environment variables

At minimum, configure:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Server-side signing secret for authentication sessions. |
| `FRONTEND_URL` | Canonical portal origin used in API links and callbacks. |
| `ALLOWED_ORIGINS` | Comma-separated browser origins accepted by API CORS. |
| `NEXT_PUBLIC_API_URL` | API origin used by the portal rewrite in local or split deployments. |
| `AGENT_API_ENABLED` | Agent API feature gate; `false` or unset is fail-closed. |

For local development, use `FRONTEND_URL=http://localhost:3006`,
`ALLOWED_ORIGINS=http://localhost:3006`, and
`NEXT_PUBLIC_API_URL=http://localhost:3001`.

Never put database passwords, JWT secrets, OAuth client secrets, API keys,
encryption keys, MLS tokens, or storage secret keys in browser-exposed
`NEXT_PUBLIC_*` variables or in committed files. Use a deployment secret
manager for production values.

## Enabling the Agent API

Set this on the API service:

```dotenv
AGENT_API_ENABLED=true
```

Restart the API after changing it. The authenticated portal layout checks the
same server-side gate. When it is disabled, `/agent` renders a feature-disabled
message rather than attempting Agent requests. This is intentional fail-closed
behavior; the frontend does not bypass the gate.

## Running the API and frontend

Run the combined development workflow:

```bash
npm run dev
```

Or run the services independently in separate terminals:

```bash
npm run dev:api
npm run dev:portal
```

The API does not run migrations automatically. Run `npm run db:migrate`
explicitly when the database schema changes.

## Authentication flow

The portal uses the existing account/session authentication flow. The Agent
layout calls `loadAgentSession()` before rendering Agent pages:

1. An unauthenticated browser is redirected to `/login` with an Agent return
   path.
2. An authenticated session is checked against the Agent API gate.
3. A valid session renders `AgentShell` and the requested Agent page.
4. The API authorizes Agent routes from the authenticated server-side session.

The frontend does not accept tokens from query parameters, expose encrypted
provider tokens, or treat a failed session check as an authenticated state.

## Agent route map

| Route | Page |
| --- | --- |
| `/agent` | Dashboard |
| `/agent/contacts`, `/agent/contacts/new`, `/agent/contacts/:id` | Contacts |
| `/agent/transactions`, `/agent/transactions/new`, `/agent/transactions/:id`, `/agent/transactions/pipeline` | Transactions |
| `/agent/properties` | Property discovery |
| `/agent/listings`, `/agent/listings/:id` | Listings |
| `/agent/tasks` | Tasks |
| `/agent/events` | Calendar and events |
| `/agent/inquiries` | Lead and inquiry inbox |
| `/agent/portals`, `/agent/portals/:id` | Portal management |
| `/agent/segments` | Listing segments |
| `/agent/reports` | Reports and embedded market-report management |
| `/agent/market-reports/:id` | Market-report detail |
| `/agent/campaigns`, `/agent/campaigns/:id` | Campaigns |
| `/agent/ai` | AI Assistant and action queue |
| `/agent/mls` | MLS verification |
| `/agent/google` | Google Workspace settings, calendar, and contact activity |
| `/agent/settings` | Agent profile settings |

The navigation's Market Reports item points to the market-report section on
`/agent/reports`; Action Queue points to the action section of `/agent/ai`.
Those links reuse the existing pages and do not imply separate backend
resources.

## API endpoint-to-page mapping

The portal calls Agent endpoints through the authenticated
`/api/agent/[...path]` proxy. The principal mappings are:

| Page | API resources |
| --- | --- |
| Dashboard | `GET /api/agent/dashboard` |
| Contacts | `GET/POST/PUT/DELETE /api/agent/contacts`, contact detail and interaction routes |
| Transactions | `GET/POST/PUT/DELETE /api/agent/transactions`, parties, milestones, documents, sync, and message routes |
| Tasks and calendar | Agent task, event, note, attendee, and completion routes used by the productivity page |
| Properties and listings | Agent property/listing search, detail, suggestions, and history routes |
| Inquiries | `/api/agent/inquiries`, portal inquiry routes, and owner lead/export routes |
| Portals | `/api/agent/portals` CRUD, readiness, ping, test inquiry, logo upload URL, and featured-listing routes |
| Segments | `/api/agent/segments` CRUD, listing counts, suggestions, plus the `/api/agent/neighborhoods/*` compatibility alias |
| Reports | `/api/agent/reports/summary`, `/trend`, `/forecast`; market-report CRUD and generate routes |
| Campaigns | `/api/agent/campaigns` CRUD, `generate-content`, and `/api/agent/ai/marketing-copy` |
| AI Assistant and Action Queue | `/api/agent/ai/chat`, conversations, actions, review/dismiss/snooze/execute, and scan routes |
| MLS | `GET/POST /api/agent/mls/status` and `/verify` |
| Google Workspace | Google status, scopes, OAuth callback, connection deletion, calendar, and contact activity routes |
| Navigation search | `GET /api/agent/search?q=...&limit=...` |

The frontend follows the response contracts implemented by the API. It does
not add unsupported filters, upload endpoints, direct email sending, campaign
publishing, or DNS mutation operations.

## Google integration setup

Google Workspace requires server-side configuration:

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_TOKEN_ENCRYPTION_KEY=...
AGENT_HQ_URL=http://localhost:3006
```

Configure the corresponding OAuth redirect URI and Google API consent scopes
in Google Cloud. `AGENT_HQ_URL` must match the API's allowed Agent OAuth
return origin. Production values must use the deployed HTTPS portal origin.

The browser receives connection status, scopes, calendar data, and contact
activity only. It never receives Google client secrets, access tokens, refresh
tokens, or encrypted token values. If configuration is missing, expired, or
denied, the page shows a disconnected/unavailable state and does not fabricate
connected data.

## OpenAI integration setup

AI Assistant, AI marketing copy, forecasts, and some analysis services use the
server-side OpenAI integration when their corresponding backend feature is
enabled:

```dotenv
OPENAI_API_KEY=...
```

Keep the key only in the API service environment. The portal sends requests to
the Agent API and receives user-safe responses or SSE frames. Missing keys,
provider failures, malformed/truncated streams, and dropped connections are
shown as recoverable UI errors; the frontend never exposes the key or raw
provider stack traces.

Chat never calls the action execute endpoint. Side effects are available only
from the action queue's explicit confirmation flow.

## MLS verification and compliance

Agent MLS verification requires the API to know which board is being used:

```dotenv
MLS_BOARD_ID=...
```

The value must match the separately configured MLS worker board. Without it,
the MLS verification page reports a configuration-disabled state. Verification
links an agent's membership to the configured board; it does not automatically
enable public MLS display.

Public listing visibility is separately gated by the API and worker setting:

```dotenv
MLS_PUBLIC_DISPLAY_ENABLED=false
```

Keep public display disabled until board approval, compliance review, and the
post-deployment reindex requirements are complete. MLS access tokens remain
server-side.

## Typesense and Redis behavior

Typesense and Redis are optional:

- Leave `TYPESENSE_HOST` unset to use the PostgreSQL search fallback, including
  Agent search.
- If Typesense is configured, provide its host, port, protocol, and server-side
  API key. Do not expose `TYPESENSE_API_KEY` to the portal.
- Set `REDIS_ENABLED=false` for the PostgreSQL-only baseline.
- When Redis is enabled, configure `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`,
  and `REDIS_DB` on the API service.

These services improve search or caching but are not prerequisites for the
core portal and API.

## Storage and logo uploads

Portal logo uploads require an S3-compatible object store configured on the API:

```dotenv
STORAGE_ENDPOINT=...
STORAGE_BUCKET=...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_PUBLIC_BASE_URL=...
```

The frontend requests a backend-generated presigned upload URL, uploads the
selected logo to that URL, and uses the returned public URL. It does not
perform bucket administration, invent upload URLs, or expose storage secret
keys. If storage is unavailable, the portal settings page reports the upload
failure.

## Testing

From the repository root:

```bash
npm run test:portal
npm run typecheck:portal
npm run test:api
npm run typecheck:api
```

For a focused Agent portal test on Windows:

```powershell
Push-Location apps\portal
..\..\node_modules\.bin\vitest.cmd run components\agent\agent-navigation.test.tsx --pool=threads --maxWorkers=1
Pop-Location
```

Use the relevant Agent component test instead of the navigation test when
checking another page. Tests mock network calls; they do not require real
OpenAI, Google, MLS, Redis, Typesense, or storage credentials.

## Production deployment

Build the API and portal from the repository root:

```bash
npm run build:api
npm run build --workspace=portal
```

Provision PostgreSQL, apply migrations as a release step, and provide runtime
secrets through the platform's secret manager. Configure:

- `FRONTEND_URL` and `ALLOWED_ORIGINS` with the deployed portal origin.
- `NEXT_PUBLIC_API_URL` according to the deployment's API routing.
- `AGENT_API_ENABLED=true` only when the Agent API is intentionally exposed.
- Google, OpenAI, MLS, Typesense, Redis, and storage variables only for
  integrations actually provisioned.

For Railway, internal PostgreSQL hostnames are reachable only from Railway
services. A workstation must use the database service's public connection URL;
never commit or log that URL. Point the deployment domain directly at
`apps/portal` as documented by the deployment configuration.

## External Agent HQ services

This public repository contains the Agent frontend, the API routes it calls,
and the local authenticated session integration. Private Agent HQ, internal
admin, marketing, and client-specific portals are separate products and are
not included here.

`AGENT_HQ_URL` is relevant when the deployment uses the Google Agent OAuth
return flow. It does not install or provide a private Agent HQ service. Do not
add private product source, credentials, or undocumented endpoints to this
repository.

## Known limitations and graceful fallback

- The Agent API is disabled by default and fails closed.
- Agent search falls back from Typesense to PostgreSQL when Typesense is not
  configured.
- Google features require server configuration and an authorized connection;
  unavailable, expired, and denied states are displayed instead of mocked.
- MLS verification requires `MLS_BOARD_ID` and does not grant public display.
- Portal logo uploads require configured object storage.
- DNS changes are never performed by the custom-domain UI; agents configure
  DNS externally and use backend verification.
- Chat can suggest or surface action items but cannot execute side effects.
- Campaign content is editable draft content; the frontend does not send or
  publish it without an explicitly supported backend endpoint.
- Market forecasts and generated reports are labeled as forecasts or generated
  analysis and are not guarantees or financial advice.
- There is no frontend direct-email-send capability unless a backend endpoint
  explicitly provides one.

## Troubleshooting

### 401 Unauthorized

Sign in again and verify that the portal session cookie is present for the
portal origin. Confirm that the browser is using the expected API origin and
that the API session has not expired. Do not paste tokens into the browser or
URL.

### 403 Forbidden

The session is authenticated but lacks permission for the requested resource,
or the resource belongs to another account. Check the authenticated account,
Agent role, and API authorization logs. The frontend should show an
authorization error rather than retrying indefinitely.

### 404 Not Found

Confirm the API and portal are running compatible revisions and that the
requested resource ID exists. A 404 can also mean that a page is linking to a
route not included in the deployed build; inspect the route map above.

### CORS or failed network requests

Set `ALLOWED_ORIGINS` to the exact portal origin, including the correct scheme
and port, and set `FRONTEND_URL` consistently. Restart the API after changing
environment variables. In split deployments, verify `NEXT_PUBLIC_API_URL` and
the API's public URL.

### Agent API disabled

Set `AGENT_API_ENABLED=true` on the API service and restart it. If the page
still shows the disabled message, check the API environment rather than only
the portal environment; the gate is evaluated server-side.

### Database errors

Verify `DATABASE_URL`, network access, PostgreSQL availability, and migration
state. Run:

```bash
npm run build --workspace=db
npm run db:migrate
```

Do not run destructive demo reset or seed commands against production. Demo
commands require the exact `CONFIRM_DEMO_SEED` database target and refuse to
run in production.

