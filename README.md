# Real Estate Gear

![Node.js](https://img.shields.io/badge/Node.js-22.12.0+-339933?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-yellow)

**Repository**: https://github.com/realsudarshan/realestategear  
**Live Demo**: https://realestategear-portal.onrender.com (🚧 Building in progress)

## Description

Real Estate Gear is a self-hostable, full-stack real estate operating system built with Node.js, TypeScript, Next.js, and PostgreSQL. It provides a complete agent workspace with CRM, transaction management, AI-powered workflows, and MLS integration, alongside a customer-facing property portal for listing search and inquiries. Designed for real estate professionals who want full control over their data and branding without SaaS dependencies.

## Overview

Real Estate Gear is a comprehensive real estate management system that combines an agent workspace CRM, transaction management, AI-powered workflows, MLS integration, and customer-facing property portals into a single self-hostable platform.

- **Real Estate Gear Agent**: A CRM, transaction and AI assistant workspace for real estate professionals. Search listings and contacts, run an agent deal pipeline, sync Gmail/Google Drive, draft AI marketing copy, manage branded portals, and review approval-based AI actions.
- **Real Estate Gear Portal**: The customer-facing side — branded public sites, listing search and discovery, inquiries, saved searches and account favorites.

![Real Estate Gear Dashboard](references/landing.png)

## Key Features

### Agent Workspace
- **CRM & Contact Management**: Track contacts, interactions, stages, tags, and communication history
- **Transaction Pipeline**: Manage deals with milestone-based workflows, document tracking, and email synchronization
- **Task Management**: Create, track, and complete tasks linked to contacts and transactions
- **Calendar Integration**: Manage events, appointments, and attendee tracking
- **AI Assistant**: Chat with AI to search contacts, properties, and generate marketing content
- **Action Queue**: Review and approve AI-suggested actions (emails, follow-ups, task creation)
- **Market Reports**: Generate comparative market analysis (CMA) reports
- **Campaign Management**: Create and manage marketing campaigns with AI-generated content
- **Google Workspace Integration**: Sync Gmail, Calendar, and Drive for transaction workflows
- **Lead Inbox**: Manage portal inquiries and lead responses
- **Portal Management**: Create and manage branded public real estate websites
- **Listing Segments**: Build collections of listings by area, price range, or custom criteria
- **MLS Integration**: Verify MLS credentials and access board data
- **Custom Domains**: Add and verify custom domains for agent portals

### Public Portal
- **Property Search**: Search listings by location, price, bedrooms, bathrooms, and property type
- **Listing Discovery**: Browse communities, areas, and featured collections
- **User Accounts**: Save favorites, track saved searches, and manage inquiries
- **Responsive Design**: Mobile-first design built with Tailwind CSS
- **SEO Friendly**: Optimized for search engines with proper metadata

## Tech Stack

### Core Technologies
- **Runtime**: Node.js 22.12.0+ (npm workspaces)
- **Language**: TypeScript 5.x
- **Frontend**: Next.js 15 (App Router), React 19
- **Backend**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS with custom design tokens
- **UI Components**: Radix UI primitives with shadcn/ui patterns

### Infrastructure & Integrations
- **Search**: Typesense (optional, PostgreSQL fallback available)
- **Cache**: Redis (optional)
- **Email**: Nodemailer with SMTP support
- **Authentication**: JWT with Google OAuth
- **File Storage**: S3-compatible storage (via presigned URLs)
- **Deployment**: Render, Railway, Docker Compose support

### Shared Packages
- `@realestategear/ui`: Reusable UI components
- `@realestategear/tokens`: Design tokens and theme
- `@realestategear/api-client`: API client utilities
- `@realestategear/search`: Search abstraction layer
- `@realestategear/cache`: Cache abstraction layer
- `@realestategear/email`: Email service abstraction

## Prerequisites

- **Node.js**: >= 22.12.0 < 23 (for development)
- **Node.js**: >= 22.14.0 (for package publishing)
- **npm**: Latest version (uses `package-lock.json`, do not use pnpm or Yarn)
- **PostgreSQL**: 14+ (required)
- **Redis**: 6+ (optional, for caching)
- **Typesense**: Latest (optional, for search)

## Installation

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/realestategear.git
cd realestategear
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Set up the database**
```bash
npm run db:migrate
```

5. **Start the development server**
```bash
npm run dev
```

The portal will be available at <http://localhost:3006> and the API at <http://localhost:3001>.

### Docker Compose (All-in-One)

```bash
docker-compose up -d
```

This starts PostgreSQL, Redis, Typesense, API, and Portal services.

## Configuration

### Required Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/realestategear

# API Configuration
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Frontend URLs
FRONTEND_URL=http://localhost:3006
NEXT_PUBLIC_API_URL=http://localhost:3001

# Agent API (set to true to enable agent features)
AGENT_API_ENABLED=false
AGENT_HQ_URL=http://localhost:3006

# Google OAuth (optional)
GOOGLE_WEB_CLIENT_ID=your-client-id
GOOGLE_WEB_CLIENT_SECRET=your-client-secret
GOOGLE_WEB_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Optional Services
REDIS_ENABLED=false
TYPESENSE_HOST=http://localhost:8108
TYPESENSE_API_KEY=xyz
```

### Optional Environment Variables

- `REDIS_URL`: Redis connection string for caching
- `TYPESENSE_HOST`: Typesense host for search
- `TYPESENSE_API_KEY`: Typesense API key
- `MLS_PUBLIC_DISPLAY_ENABLED`: Enable public MLS display (default: false)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: Email configuration

## Usage

### Starting Services

```bash
# Start everything (portal + API)
npm run dev

# Start API only
npm run dev:api

# Start portal only
npm run dev:portal

# Start MLS worker
npm run dev --workspace=@realestategear/mls-service
```

### Building for Production

```bash
# Build API
npm run build:api

# Build portal
npm run build --workspace=portal

# Build all packages
npm run build:packages
```

### Running Tests

```bash
# Test API
npm run test:api

# Test portal
npm run test:portal

# Test MLS service
npm run test --workspace=@realestategear/mls-service
```

### Type Checking

```bash
# Type check API
npm run typecheck:api

# Type check portal
npm run typecheck:portal

# Type check MLS service
npm run typecheck:mls
```

### Database Operations

```bash
# Run migrations
npm run db:migrate

# Generate Prisma client after schema changes
npm run build --workspace=db

# Seed demo data (requires CONFIRM_DEMO_SEED)
export CONFIRM_DEMO_SEED='localhost:5432/realestategear'
npm run db:seed:portal
npm run db:seed:demo-listings
```

⚠️ **Warning**: Demo seed commands are guarded and require exact database match. Never set `CONFIRM_DEMO_SEED` in production.

## API Reference

For a complete list of all API routes, endpoints, and environment variables, see the [API Reference Documentation](realestate-gear-api-reference.md).

### Key API Endpoints

#### Public APIs
- `GET /health` - Health check
- `GET /api/properties` - Property search
- `GET /api/search` - Advanced search
- `POST /api/portals/:slug/inquiries` - Submit property inquiry

#### Agent APIs (requires `AGENT_API_ENABLED=true`)
- `POST /api/auth/login` - Agent login
- `GET /api/agent/dashboard` - Dashboard statistics
- `GET /api/agent/contacts` - Contact management
- `GET /api/agent/transactions` - Transaction pipeline
- `POST /api/agent/ai/chat` - AI assistant chat
- `GET /api/agent/portals` - Portal management

## Deployment

### Render

The project includes a `render.yaml` configuration for deployment to Render:

```bash
# Connect your GitHub repository to Render
# Render will automatically detect render.yaml
# Deploy PostgreSQL, API, and Portal services
```

### Railway

```bash
# Use railway.env.example as a template
# Configure environment variables in Railway dashboard
# Deploy PostgreSQL, API, and Portal services
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individual services
docker build -t realestategear-api -f Dockerfile.api .
docker build -t realestategear-portal -f Dockerfile.portal .
```

## Project Structure

```
realestategear/
├── apps/
│   ├── portal/          # Next.js public frontend
│   ├── api/             # Express backend API
│   ├── mls-service/     # MLS synchronization worker
│   └── typesense/       # Typesense search tooling
├── packages/
│   ├── db/              # Prisma schema and migrations
│   ├── ui/              # Shared UI components
│   ├── tokens/          # Design tokens
│   ├── api-client/      # API client utilities
│   ├── search/          # Search abstraction
│   ├── cache/           # Cache abstraction
│   └── email/           # Email service abstraction
├── docs/                # Documentation
├── references/          # Images and assets
├── scripts/             # Utility scripts
├── .env.example         # Environment template
├── compose.yaml         # Docker Compose configuration
├── render.yaml          # Render deployment configuration
└── package.json         # Root package.json
```

## Contributing

We welcome contributions! Please follow these guidelines:

### Reporting Bugs

1. Check existing issues first
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Node version, OS, etc.)

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and type checks (`npm run test:api && npm run typecheck:api`)
5. Commit with conventional commit messages
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and focused
- Ensure all tests pass before submitting

### Running Tests Locally

```bash
# Install dependencies
npm install

# Run all tests
npm run test:api
npm run test:portal

# Type check
npm run typecheck:api
npm run typecheck:portal
```

## Documentation

- [Agent Frontend Guide](docs/AGENT-FRONTEND.md) - Agent workspace setup and configuration
- [API Reference](realestate-gear-api-reference.md) - Complete API documentation
- [Design Contract](DESIGN.md) - Design system and UI guidelines
- [Agent Notes](AGENTS.md) - Operational boundaries and guidelines

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: See the `docs/` directory for detailed guides
- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Use GitHub Discussions for questions

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Express](https://expressjs.com/)
- [Prisma](https://www.prisma.io/)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Real Estate Gear** - One workspace for the entire real estate practice.
