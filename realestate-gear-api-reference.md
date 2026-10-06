# realestate-gear API Reference: Routes and Environment Variables

The backend is an Express API mounted from `apps/api/src/server.ts`. This document lists every route found in the repository, then the environment variables the API needs and why.

## Important configuration

Agent APIs are only registered when:

```env
AGENT_API_ENABLED=true
```

Otherwise, `/api/agent/*` returns:

```json
{
  "error": "Agent API is disabled",
  "code": "AGENT_API_DISABLED"
}
```

Most authenticated endpoints expect:

```http
Authorization: Bearer <JWT>
```

---

# Part 1: Route Inventory

## 1. Health API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Returns API health, uptime, timestamp, and search engine status |

## 2. Agent authentication APIs

File: `apps/api/src/routes/auth.ts` (for agents and internal users)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Agent login with email/password |
| POST | `/api/auth/register-agent` | Register a new agent account and company |
| GET | `/api/auth/me` | Get the currently authenticated user |
| PUT | `/api/auth/profile` | Update current agent profile |
| POST | `/api/auth/logout` | Logout response |
| POST | `/api/auth/check-email` | Check whether an agent email exists |
| POST | `/api/auth/forgot-password` | Send password-reset instructions |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/refresh` | Refresh a JWT |
| GET | `/api/auth/google/start` | Start Google OAuth |
| GET | `/api/auth/google/callback` | Complete Google OAuth |

`register-agent` is disabled unless the Agent API is enabled.

## 3. Agent dashboard API

File: `apps/api/src/routes/agentDashboard.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/dashboard` | Dashboard statistics, recent contacts, and upcoming tasks |

The response includes active contacts, open transactions, pending tasks, closed transactions this month, recent contacts, and upcoming tasks. Requires role `AGENT` or `ADMIN`.

## 4. Agent contacts / CRM API

File: `apps/api/src/routes/agentContacts.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/contacts` | List contacts |
| GET | `/api/agent/contacts/:id` | Get one contact |
| POST | `/api/agent/contacts` | Create a contact |
| PUT | `/api/agent/contacts/:id` | Update a contact |
| DELETE | `/api/agent/contacts/:id` | Delete a contact |
| PUT | `/api/agent/contacts/:id/link` | Link a contact to a portal user |
| DELETE | `/api/agent/contacts/:id/link` | Unlink a contact from a portal user |
| GET | `/api/agent/contacts/:id/interactions` | List contact interactions |
| POST | `/api/agent/contacts/:id/interactions` | Add an interaction |
| PUT | `/api/agent/contacts/:id/interactions/:interactionId` | Update an interaction |
| DELETE | `/api/agent/contacts/:id/interactions/:interactionId` | Delete an interaction |

Contacts support: name, email, phone, company, type, source, stage, tags, tracks, and calls/emails/meetings/other interactions.

## 5. Agent transactions / deals API

File: `apps/api/src/routes/agentTransactions.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/transactions` | List transactions |
| GET | `/api/agent/transactions/pipeline` | Group transactions by stage |
| GET | `/api/agent/transactions/setup-template` | Get transaction setup template |
| POST | `/api/agent/transactions/preview` | Preview milestone-based transaction plan |
| POST | `/api/agent/transactions/create-from-milestones` | Create a transaction from milestones |
| GET | `/api/agent/transactions/:id` | Get transaction details |
| POST | `/api/agent/transactions` | Create a transaction |
| PUT | `/api/agent/transactions/:id` | Update a transaction |
| DELETE | `/api/agent/transactions/:id` | Delete a transaction |
| POST | `/api/agent/transactions/:id/parties` | Add a transaction party |
| DELETE | `/api/agent/transactions/:id/parties` | Remove a transaction party |

### Transaction documents

| Method | Endpoint | Purpose |
|---|---|---| 
| GET | `/api/agent/transactions/:id/documents` | List transaction documents |
| POST | `/api/agent/transactions/:id/documents` | Add a custom document |
| DELETE | `/api/agent/transactions/:id/documents/:docId` | Delete a custom document |
| PATCH | `/api/agent/transactions/:id/documents/:docId/match` | Match a document to an attachment |
| PATCH | `/api/agent/transactions/:id/documents/:docId/unmatch` | Remove document matching |
| PATCH | `/api/agent/transactions/:id/documents/:docId/verify` | Verify a document |
| POST | `/api/agent/transactions/:id/documents/:docId/copy-to-drive` | Copy a matched document to Google Drive |

### Transaction email / Gmail sync

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/agent/transactions/:id/sync` | Start transaction email synchronization |
| GET | `/api/agent/transactions/:id/sync-runs` | Get synchronization runs |
| GET | `/api/agent/transactions/:id/discovered-messages` | List discovered email messages |
| POST | `/api/agent/transactions/:id/discovered-messages/:msgId/confirm` | Confirm a discovered message |
| POST | `/api/agent/transactions/:id/discovered-messages/:msgId/dismiss` | Dismiss a discovered message |

## 6. Agent property API

File: `apps/api/src/routes/agentProperties.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/properties` | Search/list the complete property catalog |
| GET | `/api/agent/properties/search` | Search properties by address, MLS ID, etc. |

This is an agent-level catalog and can return non-public property records.

## 7. Agent listing API

File: `apps/api/src/routes/agentListings.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/listings/discovery` | Listing discovery data |
| GET | `/api/agent/listings/search` | Search listings |
| GET | `/api/agent/listings/:id` | Get listing details |

Listing detail can include listing information, property facts, media, listing history, related transactions, and workflow information.

## 8. Agent tasks API

File: `apps/api/src/routes/agentTasks.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/tasks` | List tasks |
| POST | `/api/agent/tasks` | Create a task |
| PUT | `/api/agent/tasks/:id` | Update a task |
| DELETE | `/api/agent/tasks/:id` | Delete a task |

Tasks can be linked to contacts and transactions.

## 9. Agent events and calendar API

File: `apps/api/src/routes/agentEvents.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/events` | List events |
| GET | `/api/agent/events/:id` | Get one event |
| POST | `/api/agent/events` | Create an event |
| PUT | `/api/agent/events/:id` | Update an event |
| DELETE | `/api/agent/events/:id` | Delete an event |
| POST | `/api/agent/events/:id/attendees` | Add an attendee |
| DELETE | `/api/agent/events/:id/attendees/:attendeeId` | Remove an attendee |
| POST | `/api/agent/events/:id/complete` | Mark an event completed |

## 10. Agent notes API

File: `apps/api/src/routes/agentNotes.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/notes` | List notes |
| POST | `/api/agent/notes` | Create a note |
| PUT | `/api/agent/notes/:id` | Update a note |
| DELETE | `/api/agent/notes/:id` | Delete a note |

Notes may be associated with contacts, transactions, properties, and events.

## 11. Market reports / CMA API

File: `apps/api/src/routes/agentMarketReports.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/market-reports` | List market reports |
| GET | `/api/agent/market-reports/:id` | Get one report |
| POST | `/api/agent/market-reports` | Create a report |
| POST | `/api/agent/market-reports/generate` | Generate a report for a property |
| PUT | `/api/agent/market-reports/:id` | Update a report |
| DELETE | `/api/agent/market-reports/:id` | Delete a report |

## 12. Agent AI and AI assistant API

File: `apps/api/src/routes/agentAI.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/agent/ai/chat` | Streaming AI chat using Server-Sent Events |
| POST | `/api/agent/ai/marketing-copy` | Generate marketing content |
| GET | `/api/agent/ai/conversations` | Get saved AI conversations |
| POST | `/api/agent/ai/conversations` | Save an AI conversation |

The assistant can search agent-scoped contacts, properties, tasks, transactions, and AI action items. The chat endpoint returns `Content-Type: text/event-stream`.

## 13. AI action queue API

File: `apps/api/src/routes/agentActionQueue.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/ai/actions` | List queued AI actions |
| GET | `/api/agent/ai/actions/:id` | Get one action |
| POST | `/api/agent/ai/actions/:id/review` | Mark an action as reviewed |
| POST | `/api/agent/ai/actions/:id/dismiss` | Dismiss an action |
| POST | `/api/agent/ai/actions/:id/snooze` | Snooze an action |
| POST | `/api/agent/ai/actions/:id/execute` | Execute an approved action |
| POST | `/api/agent/ai/actions/scan-transactions` | Scan transactions for risks |
| POST | `/api/agent/ai/actions/scan-relationships` | Scan contacts for follow-up opportunities |

Action execution can send an email, update contact stage, update tags, create a task, and set task priority and due date.

## 14. Agent campaigns API

File: `apps/api/src/routes/agentCampaigns.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/campaigns` | List campaigns |
| GET | `/api/agent/campaigns/:id` | Get one campaign |
| POST | `/api/agent/campaigns` | Create a campaign |
| PUT | `/api/agent/campaigns/:id` | Update a campaign |
| DELETE | `/api/agent/campaigns/:id` | Delete a campaign |
| POST | `/api/agent/campaigns/:id/generate-content` | Generate campaign content with AI |

Campaigns support: name, type, status, content, target audience, scheduled date.

## 15. Google Workspace integration API

File: `apps/api/src/routes/agentGoogle.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/google/status` | Get Google connection status |
| GET | `/api/agent/google/scopes` | Get required Google scopes |
| POST | `/api/agent/google/oauth/callback` | Complete Google Workspace connection |
| DELETE | `/api/agent/google/connection` | Disconnect Google account |
| GET | `/api/agent/google/calendar` | Get Google Calendar events |
| GET | `/api/agent/google/contacts/:contactId/activity` | Get Google activity for a contact |

Supports Gmail/Calendar-related agent workflows.

## 16. Agent inquiry / lead inbox API

File: `apps/api/src/routes/agentInquiries.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/inquiries` | List portal inquiries/leads |
| PUT | `/api/agent/inquiries/:id/respond` | Respond to an inquiry |

Filters: status, search term, page, limit. Statuses: `NEW`, `READ`, `RESPONDED`, `ARCHIVED`.

## 17. Agent reporting API

File: `apps/api/src/routes/agentReports.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/reports/summary` | Get agent performance summary |
| GET | `/api/agent/reports/trend` | Get trend data |
| GET | `/api/agent/reports/forecast` | Get forecast data |

## 18. Agent portal-management API

File: `apps/api/src/routes/agentPortals.ts`

These routes manage an agent's public real-estate website/portal.

### Portal management

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/portals` | List agent portals |
| POST | `/api/agent/portals` | Create a portal |
| GET | `/api/agent/portals/:id` | Get portal details |
| PUT | `/api/agent/portals/:id` | Replace/update a portal |
| PATCH | `/api/agent/portals/:id` | Partially update a portal |
| DELETE | `/api/agent/portals/:id` | Delete a portal |
| GET | `/api/agent/portals/:id/readiness` | Check portal launch/listing readiness |
| POST | `/api/agent/portals/:id/test-inquiry` | Test inquiry email routing |
| GET | `/api/agent/portals/:id/preview-ping` | Check whether the public portal responds |
| GET | `/api/agent/portals/:id/logo-upload-url` | Get a presigned logo upload URL |
| PUT | `/api/agent/portals/:id/featured-listings` | Replace featured listings |

### Custom domains

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/portals/:id/domains` | List custom domains |
| POST | `/api/agent/portals/:id/domains` | Add a custom domain |
| POST | `/api/agent/portals/:id/domains/:domainId/verify` | Verify domain ownership |
| PATCH | `/api/agent/portals/:id/domains/:domainId/canonical` | Set canonical domain |
| DELETE | `/api/agent/portals/:id/domains/:domainId` | Remove custom domain |

### Portal inquiry inbox

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/portals/:id/inquiries` | List inquiries for a portal |
| PATCH | `/api/agent/portals/:id/inquiries/:inquiryId` | Update inquiry status |

## 19. Agent listing collections / segments API

Files: `apps/api/src/routes/agentSegments.ts`, `apps/api/src/routes/agentPortals.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/segments` | List listing collections/segments |
| POST | `/api/agent/segments` | Create a segment/collection |
| GET | `/api/agent/segments/:id` | Get a segment |
| PUT | `/api/agent/segments/:id` | Update a segment |
| DELETE | `/api/agent/segments/:id` | Delete a segment |
| GET | `/api/agent/segments/listing-count` | Get listing count preview |
| GET | `/api/agent/segments/:id/listing-count` | Get count for a segment |
| GET | `/api/agent/segments/suggestions` | Get filter suggestions |

Compatibility alias: `/api/agent/neighborhoods/*` points to the same segment router (kept for the old Agent HQ "neighborhoods" path).

There is also an owner-oriented API under `/api/owner/areas` and `/api/owner/collections` for fuller area and collection management.

## 20. Agent MLS API

File: `apps/api/src/routes/agentMls.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/mls/status` | Get current MLS verification status |
| POST | `/api/agent/mls/verify` | Submit an MLS membership ID for verification |

Returns MLS board ID, board name, membership ID, and verification timestamp.

## 21. Unified agent search API

File: `apps/api/src/routes/agentSearch.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/agent/search` | Unified command-palette search |

Searches contacts, transactions, properties, and tasks. Uses Typesense when configured, PostgreSQL fallback otherwise.

## 22. General property APIs

File: `apps/api/src/routes/properties.ts`

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/properties` | Public |
| GET | `/api/properties/:identifier` | Public |
| POST | `/api/properties` | Admin |
| PUT | `/api/properties/:id` | Admin |
| DELETE | `/api/properties/:id` | Admin |
| GET | `/api/properties/:id/media` | Public |
| POST | `/api/properties/:id/media` | Admin |

## 23. General search APIs

File: `apps/api/src/routes/search.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/search` | Property search |
| GET | `/api/search/geo` | Search properties within geographic bounds |
| GET | `/api/search/suggestions` | Address, city, and property-type suggestions |
| GET | `/api/search/stats` | Typesense collection statistics |
| GET | `/api/search/key` | Get a scoped Typesense search key |
| POST | `/api/search/reindex/:collection` | Reindex Typesense data (admin only) |

Reindex collections: `properties`, `contacts`, `transactions`, `notes`, `tasks`, `all`.

## 24. Portal public APIs

File: `apps/api/src/routes/portalPublic.ts`

These power the public websites created by agents.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/portals/slug/:slug/available` | Check portal slug availability |
| GET | `/api/portals/slug/:slug` | Get public portal information |
| GET | `/api/portals/slug/:slug/readiness` | Get public listing readiness |
| GET | `/api/portals/slug/:slug/listings` | Get portal listings |
| GET | `/api/portals/slug/:slug/areas/:itemSlug` | Get listings for a public area |
| GET | `/api/portals/slug/:slug/collections/:itemSlug` | Get listings for a collection |
| GET | `/api/portals/slug/:slug/properties/:identifier` | Get a public property |
| GET | `/api/portals/slug/:slug/config` | Get public portal configuration |
| GET | `/api/portals/slug/:slug/listing-policy` | Get public listing/MLS policy |
| GET | `/api/portals/domain/:hostname` | Look up portal by custom domain |
| GET | `/api/portals/domain/:hostname/config` | Get configuration by custom domain |
| POST | `/api/portals/:slug/inquiries` | Submit a public property inquiry |

## 25. Portal consumer authentication APIs

File: `apps/api/src/routes/portalAuth.ts` (for consumers of an agent's public portal, not agents)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/portals/:slug/auth/register` | Register a consumer |
| POST | `/api/portals/:slug/auth/login` | Consumer login |
| GET | `/api/portals/:slug/auth/google/start` | Start Google consumer login |

## 26. Consumer user APIs

File: `apps/api/src/routes/users.ts` (mounted under authentication middleware)

| Group | Method | Endpoint | Purpose |
|---|---|---|---|
| Profile | GET | `/api/users/profile` | Get user profile |
| Favorites | GET | `/api/users/favorites` | List favorite listings |
| Favorites | POST | `/api/users/favorites` | Add a favorite |
| Favorites | DELETE | `/api/users/favorites/:listingId` | Remove a favorite |
| Inquiries | GET | `/api/users/inquiries` | List user inquiries |
| Inquiries | POST | `/api/users/inquiries` | Submit an inquiry |
| Inquiries | PUT | `/api/users/inquiries/:inquiryId` | Update/respond (agent/admin role required) |
| Saved searches | GET | `/api/users/saved-searches` | List saved searches |
| Saved searches | GET | `/api/users/saved-searches/:id` | Get one saved search |
| Saved searches | POST | `/api/users/saved-searches` | Create saved search |
| Saved searches | PUT | `/api/users/saved-searches/:id` | Update saved search |
| Saved searches | DELETE | `/api/users/saved-searches/:id` | Delete saved search |
| Saved searches | POST | `/api/users/saved-searches/:id/run` | Run saved search |
| Admin | GET | `/api/users` | List users (admin only) |
| Admin | PUT | `/api/users/:id` | Update user (admin only) |
| Admin | DELETE | `/api/users/:id` | Delete user (admin only) |

## 27. Owner lead-management APIs

File: `apps/api/src/routes/ownerLeads.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/owner/leads` | List portal leads/inquiries |
| PATCH | `/api/owner/leads/:id` | Update lead status |
| GET | `/api/owner/leads/export.csv` | Export leads as CSV |

Filters: status, source, search, portal, cursor pagination.

## 28. Owner area and collection APIs

File: `apps/api/src/routes/ownerCollections.ts`

### Geographic areas

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/owner/areas` | List geographic areas |
| POST | `/api/owner/areas` | Create an area |
| GET | `/api/owner/areas/:id` | Get an area |
| PATCH | `/api/owner/areas/:id` | Update an area |
| DELETE | `/api/owner/areas/:id` | Delete an area |

### Listing collections

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/owner/collections` | List collections for a portal |
| POST | `/api/owner/collections` | Create a collection |
| GET | `/api/owner/collections/:id` | Get a collection |
| PATCH | `/api/owner/collections/:id` | Update a collection |
| DELETE | `/api/owner/collections/:id` | Delete a collection |
| POST | `/api/owner/collections/:id/preview` | Preview matching listings |
| PUT | `/api/owner/collections/:id/overrides/:propertyId` | Include/exclude a property manually |
| DELETE | `/api/owner/collections/:id/overrides/:propertyId` | Remove manual override |
| GET | `/api/owner/classification-coverage` | Get classification coverage |

## 29. Admin APIs

### Admin property dashboard

File: `apps/api/src/routes/admin.ts`, mounted at `/api/admin`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/stats` | Admin dashboard statistics |
| GET | `/api/admin/properties` | List all properties |
| PUT | `/api/admin/properties/:id/status` | Update property listing status |
| POST | `/api/admin/bulk-import` | Bulk import properties |

### Admin account management

File: `apps/api/src/routes/adminAccounts.ts`, mounted at `/api/admin/accounts`, protected by the admin secret middleware.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/accounts` | List accounts with health signals |
| GET | `/api/admin/accounts/:id` | Get account details |
| PATCH | `/api/admin/accounts/:accountId/portals/:portalId/suspend` | Suspend or unsuspend a portal |

## 30. Public contact API

File: `apps/api/src/routes/contact.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/contact` | Submit the general public contact form |

## 31. Cron and background-job APIs

File: `apps/api/src/routes/cron.ts`. These require a cron bearer token using `CRON_SECRET`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/cron/saved-search-alerts` | Send saved-search email alerts |
| POST | `/api/cron/lead-response-recovery` | Recover/enqueue missing AI lead-response actions |
| POST | `/api/cron/inquiry-deliveries` | Dispatch inquiry email deliveries |
| POST | `/api/cron/relationship-memory-scan` | Scan agents' contacts for follow-up opportunities |
| POST | `/api/cron/transaction-risk-scan` | Scan transactions for risk factors |
| POST | `/api/cron/mls-status-check` | Recheck MLS membership status |

Required header:

```http
Authorization: Bearer <CRON_SECRET>
```

## 32. Email API

File: `apps/api/src/routes/email.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/email/unsubscribe` | Unsubscribe a user from marketing/setup emails |

## Agent API module summary

Dashboard, Authentication, Contacts, Interactions, Transactions, Transaction pipeline, Transaction documents, Gmail synchronization, Properties, Listings, Tasks, Events, Notes, Market reports, AI chat, AI action queue, Campaigns, Google Workspace, Inquiries/leads, Reports, Portals, Custom domains, Listing segments/collections, MLS verification, Unified search.

The complete route mounting is defined in `apps/api/src/server.ts`.

---

# Part 2: Environment Variables

The variables fall into required, agent-specific, and optional integration groups.

## 1. Minimum variables required to start the API

```env
DATABASE_URL=postgresql://realestate-gear:password@localhost:5432/realestate-gear_dev?schema=public
JWT_SECRET=use-a-long-random-secret
JWT_EXPIRES_IN=7d
NODE_ENV=development
API_PORT=3001
```

| Variable | Why it is needed |
|---|---|
| `DATABASE_URL` | PostgreSQL connection used by Prisma for users, agents, contacts, transactions, tasks, listings, portals, and all other data |
| `JWT_SECRET` | Signs and verifies authentication tokens; the API cannot safely authenticate users without it |
| `JWT_EXPIRES_IN` | Controls how long login tokens remain valid |
| `NODE_ENV` | Controls development/production behavior, rate limiting, and seed protections |
| `API_PORT` | Port where the Express API listens (defaults to 3001) |

`DATABASE_URL` and `JWT_SECRET` are the minimum runtime requirements. Migrations must be applied separately:

```bash
npm run db:migrate
```

## 2. Enable the agent APIs

```env
AGENT_API_ENABLED=true
```

| Variable | Why it is needed |
|---|---|
| `AGENT_API_ENABLED` | Enables `/api/agent/*` routes (dashboard, contacts, transactions, tasks, AI tools, portals, MLS, reports). Default is `false` |

## 3. Frontend and CORS configuration

```env
FRONTEND_URL=http://localhost:3006
ALLOWED_ORIGINS=http://localhost:3006
```

| Variable | Why it is needed |
|---|---|
| `FRONTEND_URL` | Used when generating links in emails and redirects |
| `ALLOWED_ORIGINS` | Controls which frontend origins can make browser requests to the API (CORS) |

For an external Agent HQ frontend:

```env
FRONTEND_URL=https://agent.example.com
ALLOWED_ORIGINS=https://agent.example.com
```

For multiple frontends:

```env
ALLOWED_ORIGINS=https://agent.example.com,https://portal.example.com
```

The Agent HQ frontend is not inside this repository, so its own environment variables must be configured separately.

## 4. Cron and background job security

```env
CRON_SECRET=another-long-random-secret
```

| Variable | Why it is needed |
|---|---|
| `CRON_SECRET` | Protects background-job endpoints (saved-search alerts, AI recovery, relationship scans, transaction-risk scans, inquiry delivery, MLS status checks) |

Cron requests must send `Authorization: Bearer <CRON_SECRET>`. Without it, cron endpoints reject requests with `401 Unauthorized`.

## 5. Email configuration

```env
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@example.com
```

| Variable | Why it is needed |
|---|---|
| `RESEND_API_KEY` | Lets the API send password-reset, welcome, lead notification, saved-search alert, and portal launch emails |
| `EMAIL_FROM` | Sender address for outgoing email |

Optional for basic local startup, but required for: password reset, agent welcome messages, public inquiry notifications, saved-search alerts, portal launch notifications, AI-generated lead responses, and unsubscribe handling.

## 6. Agent AI features

```env
OPENAI_API_KEY=your-openai-api-key
```

| Variable | Why it is needed |
|---|---|
| `OPENAI_API_KEY` | Enables Agent AI chat, marketing-copy generation, campaign content generation, and AI-assisted workflows |

Required for `POST /api/agent/ai/chat`, `POST /api/agent/ai/marketing-copy`, and `POST /api/agent/campaigns/:id/generate-content`. Without it, the rest of the Agent CRM API still works.

## 7. Google Workspace integration

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_TOKEN_ENCRYPTION_KEY=use-a-long-random-key
```

| Variable | Why it is needed |
|---|---|
| `GOOGLE_CLIENT_ID` | Identifies the application to Google |
| `GOOGLE_CLIENT_SECRET` | Lets the API exchange OAuth authorization codes |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Encrypts stored Google access and refresh tokens |

Needed for `/api/agent/google/*`: account connection, Calendar events, Gmail/contact activity, transaction email sync, and copying documents to Google Drive. The Google OAuth redirect URI and callback configuration must also match the deployment environment.

## 8. Redis cache (optional)

```env
REDIS_ENABLED=false
```

To enable:

```env
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

| Variable | Why it is needed |
|---|---|
| `REDIS_ENABLED` | Turns Redis-backed caching on or off |
| `REDIS_HOST` | Redis hostname |
| `REDIS_PORT` | Redis port, normally 6379 |
| `REDIS_PASSWORD` | Optional Redis authentication |
| `REDIS_DB` | Redis database number |

The backend falls back to PostgreSQL when Redis is disabled or unavailable.

## 9. Typesense search (optional)

```env
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=your-typesense-key
```

| Variable | Why it is needed |
|---|---|
| `TYPESENSE_HOST` | Typesense server hostname |
| `TYPESENSE_PORT` | Typesense server port |
| `TYPESENSE_PROTOCOL` | Usually `http` or `https` |
| `TYPESENSE_API_KEY` | Authenticates API requests to Typesense |

Improves property search, agent unified search, autocomplete, and contact/transaction/task search. If omitted, the API uses PostgreSQL fallback search.

## 10. Portal logo and image storage (optional)

```env
STORAGE_ENDPOINT=https://...
STORAGE_BUCKET=realestate-gear
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_PUBLIC_BASE_URL=https://cdn.example.com
```

| Variable | Why it is needed |
|---|---|
| `STORAGE_ENDPOINT` | S3/R2-compatible storage endpoint |
| `STORAGE_BUCKET` | Bucket used for uploaded assets |
| `STORAGE_ACCESS_KEY` | Storage credentials |
| `STORAGE_SECRET_KEY` | Storage credentials |
| `STORAGE_PUBLIC_BASE_URL` | Public URL used to serve uploaded logos/images |

Used for agent portal logos, MLS images, portal media, and presigned logo upload URLs. Without them the API runs, but storage-based features are unavailable.

## 11. MLS agent verification

```env
MLS_BOARD_ID=your-board-id
MLS_PREFIX=
MLS_PROVIDER_ID=mls
```

| Variable | Why it is needed |
|---|---|
| `MLS_BOARD_ID` | Identifies the MLS board used by the deployment |
| `MLS_PREFIX` | Optional listing/board ID prefix |
| `MLS_PROVIDER_ID` | Optional namespace for MLS database records |

Power `GET /api/agent/mls/status` and `POST /api/agent/mls/verify`. If `MLS_BOARD_ID` is not configured, MLS verification stays disabled. The API and MLS worker must use matching board configuration.

## 12. MLS synchronization worker

These belong to `apps/mls-service`, not only the API.

### Common variables

```env
DATABASE_URL=postgresql://...
NODE_ENV=development
LOG_LEVEL=info
```

### Static bearer-token authentication

```env
MLS_AUTH_TYPE=static
MLS_BASE_URL=https://provider.example.com/reso/odata
MLS_ACCESS_TOKEN=your-mls-token
MLS_BOARD_ID=your-board-id
```

### OAuth client-credentials authentication

```env
MLS_AUTH_TYPE=oauth2_client_credentials
MLS_BASE_URL=https://provider.example.com/reso/odata
MLS_OAUTH_TOKEN_URL=https://provider.example.com/oauth/token
MLS_OAUTH_CLIENT_ID=...
MLS_OAUTH_CLIENT_SECRET=...
MLS_OAUTH_SCOPE=...
MLS_BOARD_ID=your-board-id
```

### Worker controls

```env
MLS_SYNC_ENABLED=false
MLS_PUBLIC_DISPLAY_ENABLED=false
```

| Variable | Why it is needed |
|---|---|
| `MLS_AUTH_TYPE` | Selects static-token or OAuth authentication |
| `MLS_BASE_URL` | MLS RESO Web API URL |
| `MLS_ACCESS_TOKEN` | Static MLS access token |
| `MLS_OAUTH_TOKEN_URL` | OAuth token endpoint |
| `MLS_OAUTH_CLIENT_ID` | OAuth client ID |
| `MLS_OAUTH_CLIENT_SECRET` | OAuth client secret |
| `MLS_OAUTH_SCOPE` | OAuth permissions scope |
| `MLS_BOARD_ID` | Board being synchronized |
| `MLS_SYNC_ENABLED` | Enables actual MLS synchronization |
| `MLS_PUBLIC_DISPLAY_ENABLED` | Allows MLS data to be displayed publicly; must match the API setting |

Both flags should normally stay disabled until MLS licensing and compliance requirements are completed.

## 13. MLS worker tuning variables (optional)

```env
MLS_PAGE_SIZE=5000
MLS_TIMEOUT_MS=30000
MLS_MIN_REQUEST_INTERVAL_MS=500
MLS_MAX_RETRIES=3
MLS_RETRY_BASE_DELAY_MS=1000
```

These control records per page, request timeout, minimum delay between requests, retry count, and retry backoff delay.

## 14. Demo seed protection

Only needed when running demo seed commands:

```env
CONFIRM_DEMO_SEED=localhost:5432/realestate-gear_dev?schema=public
```

This prevents running demo seeds against the wrong database.

```bash
export CONFIRM_DEMO_SEED='localhost:5432/realestate-gear_dev?schema=public'
npm run db:demo:reset:agent
```

Do not configure this in production.

---

# Recommended local agent API environment

```dotenv
DATABASE_URL="postgresql://realestate-gear:change-me@localhost:5432/realestate-gear_dev?schema=public"

NODE_ENV=development
API_PORT=3001
LOG_LEVEL=info

JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:3006
ALLOWED_ORIGINS=http://localhost:3006

AGENT_API_ENABLED=true

MLS_PUBLIC_DISPLAY_ENABLED=false
REDIS_ENABLED=false

# Optional search
# TYPESENSE_HOST=localhost
# TYPESENSE_PORT=8108
# TYPESENSE_PROTOCOL=http
# TYPESENSE_API_KEY=

# Optional email
# RESEND_API_KEY=
# EMAIL_FROM=noreply@example.com

# Optional Agent AI
# OPENAI_API_KEY=

# Optional Google Workspace
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_TOKEN_ENCRYPTION_KEY=

# Optional portal storage
# STORAGE_ENDPOINT=
# STORAGE_BUCKET=
# STORAGE_ACCESS_KEY=
# STORAGE_SECRET_KEY=
# STORAGE_PUBLIC_BASE_URL=

# Required only if using protected cron jobs
CRON_SECRET="replace-with-another-long-random-secret"
```

## Absolute minimum for the agent backend

```dotenv
DATABASE_URL=...
JWT_SECRET=...
AGENT_API_ENABLED=true
```

In practice, also set:

```dotenv
NODE_ENV=development
API_PORT=3001
FRONTEND_URL=...
ALLOWED_ORIGINS=...
```

Then run:

```bash
npm install
npm run build --workspace=db
npm run db:migrate
npm run dev:api
```

## Environment templates

- `/.env.example`
- `apps/api/.env.example`
- `apps/mls-service/.env.example`
- `docs/DEPLOYMENT.md`
