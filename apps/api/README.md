# Real Estate Gear API

Express.js backend API for the Real Estate Gear real estate platform.

## Features

- 🏠 Property CRUD operations with advanced filtering
- 🔐 JWT-based authentication and authorization
- 📊 Admin dashboard with statistics
- 🛡️ Comprehensive input validation and security
- 📱 Media management for property images
- 🔍 Advanced search capabilities
- 📈 Pagination and sorting

## Docker / Railway

Use `apps/api/Dockerfile` as the Dockerfile path (build context must be the **monorepo root**).

```bash
docker build -f apps/api/Dockerfile .
```

Provide `DATABASE_URL` and other secrets at **runtime** (not build time). The container runs `prisma migrate deploy` then starts the server.

Default port: `3001` (override with `API_PORT`).

Set `LOG_LEVEL=debug|info|warn|error|silent` to control API log output. Defaults stay unchanged: `debug` in development, `info` otherwise.

## Getting Started

### Prerequisites

- Node.js 18+
- Database connection (configured in packages/db)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run in development mode:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/register-agent` - Agent self-signup (creates User + Account + OWNER membership). Rate-limited 5/15min/IP.
- `POST /api/auth/refresh` - Refresh JWT token

### Properties
- `GET /api/properties` - List properties with filtering
- `GET /api/properties/:id` - Get single property
- `POST /api/properties` - Create property (auth required)
- `PUT /api/properties/:id` - Update property (auth required)
- `DELETE /api/properties/:id` - Delete property (auth required)
- `GET /api/properties/:id/media` - Get property media
- `POST /api/properties/:id/media` - Add property media (auth required)

### Users
- `GET /api/users/profile` - Get current user profile (auth required)
- `GET /api/users` - List all users (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Agent Portals
All portal routes require agent authentication.

- `GET /api/agent/portals` - List portals for the authenticated agent
- `POST /api/agent/portals` - Create a portal (`name`, `slug` required; `isActive: true` requires `agentEmail` to be set)
- `GET /api/agent/portals/:id` - Get portal with featured properties (owner only)
- `PUT /api/agent/portals/:id` - Full update (owner only; slug collision → 409)
- `PATCH /api/agent/portals/:id` - Partial update (owner only; slug collision → 409)
- `DELETE /api/agent/portals/:id` - Delete portal (owner only)
- `GET /api/agent/portals/:id/logo-upload-url` - Get presigned R2/S3 upload URL (`?contentType=image/jpeg|png|webp`)
- `PUT /api/agent/portals/:id/featured-properties` - Replace featured properties list (`{ propertyIds: string[] }`, max 6)

### Admin
- `GET /api/admin/stats` - Dashboard statistics (admin only)
- `GET /api/admin/properties` - Admin property view (admin only)
- `PUT /api/admin/properties/:id/status` - Update property status (admin only)
- `POST /api/admin/bulk-import` - Bulk import properties (admin only)

### Email
- `GET /api/email/unsubscribe?token=<token>` - One-click unsubscribe from setup/marketing emails (HMAC-signed token, no auth required). Sets `User.marketingEmailsOptOutAt`; transactional emails (portal launched, MLS status flagged) ignore this flag.

### Cron
Cron routes require a `CRON_SECRET` bearer token and are intended to be called by a scheduler (e.g. Railway cron), not end users.

- `POST /api/cron/saved-search-alerts` - Runs saved search email alerts.
- `POST /api/cron/lead-response-recovery` - Scans for recent lead sources without an active AIAction and enqueues them. Idempotency key prevents duplicate actions; safe to run frequently.
- `POST /api/cron/relationship-memory-scan` - Runs the relationship memory scan for all agents (or a specific `agentId` in the body).
- `POST /api/cron/transaction-risk-scan` - Runs the transaction risk scan for all agents (or a specific `agentId` in the body).

### Health Check
- `GET /health` - API health status

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error message",
  "details": {} // Optional additional details
}
```

## Development

- Uses Node.js --watch for hot reloading
- Comprehensive logging with different levels
- Input validation using Joi schemas
- Rate limiting for API protection
