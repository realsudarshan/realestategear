import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from monorepo root first (shared vars like DATABASE_URL), then api .env (overrides)
const projectRoot = join(__dirname, '../../..');
dotenv.config({ path: join(projectRoot, '.env') });
dotenv.config({ path: join(__dirname, '../.env'), override: true });

import express from 'express';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import logger from './utils/logger.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import propertyRoutes from './routes/properties.js';
import searchRoutes from './routes/search.js';
import adminRoutes from './routes/admin.js';
import adminAccountsRoutes from './routes/adminAccounts.js';
import { adminAuth } from './middleware/adminAuth.js';
import contactRoutes from './routes/contact.js';
import cronRoutes from './routes/cron.js';
import agentDashboardRoutes from './routes/agentDashboard.js';
import agentContactRoutes from './routes/agentContacts.js';
import agentTransactionRoutes from './routes/agentTransactions.js';
import agentPropertyRoutes from './routes/agentProperties.js';
import agentListingRoutes from './routes/agentListings.js';
import agentTaskRoutes from './routes/agentTasks.js';
import agentEventRoutes from './routes/agentEvents.js';
import agentNoteRoutes from './routes/agentNotes.js';
import agentMarketReportRoutes from './routes/agentMarketReports.js';
import agentAIRoutes from './routes/agentAI.js';
import agentActionQueueRoutes from './routes/agentActionQueue.js';
import agentCampaignRoutes from './routes/agentCampaigns.js';
import agentGoogleRoutes from './routes/agentGoogle.js';
import agentInquiryRoutes from './routes/agentInquiries.js';
import agentReportsRoutes from './routes/agentReports.js';
import agentPortalRoutes from './routes/agentPortals.js';
import agentSearchRoutes from './routes/agentSearch.js';
import agentSegmentRoutes from './routes/agentSegments.js';
import agentMlsRoutes from './routes/agentMls.js';
import portalPublicRoutes from './routes/portalPublic.js';
import portalAuthRoutes from './routes/portalAuth.js';
import emailRoutes from './routes/email.js';
import ownerLeadsRoutes from './routes/ownerLeads.js';
import ownerCollectionsRoutes from './routes/ownerCollections.js';
import { ensureBootstrapAdmin } from './services/bootstrapAdmin.js';
import { ensureCollections, isTypesenseConfigured } from './search/index.js';

import { authMiddleware, requireRole } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

export const AGENT_API_DISABLED_CODE = 'AGENT_API_DISABLED';

export function parseAgentApiEnabled(value: string | undefined): boolean {
  return value === 'true';
}

// Validate required environment variables
const validateEnvironment = () => {
  const requiredEnvVars = ['JWT_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logger.error('Please set the following environment variables before starting the server:');
    missingVars.forEach(varName => {
      logger.error(`  ${varName}`);
    });
    process.exit(1);
  }

  logger.info('✅ Environment validation passed');
};

type CreateAppOptions = {
  agentApiEnabled?: boolean;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const agentApiEnabled = options.agentApiEnabled
    ?? parseAgentApiEnabled(process.env.AGENT_API_ENABLED);

  // Trust first proxy (Railway ingress)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3002').split(',').map(s => s.trim()),
    credentials: true
  }));
  app.use(compression());

  // Request logging
  app.use(morgan('combined'));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
    skip: () => process.env.NODE_ENV !== 'production',
  });
  app.use(limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        search: {
          engine: 'Typesense',
          status: 'active'
        }
      });
    } catch (error) {
      res.status(500).json({ status: 'unhealthy', error: error.message });
    }
  });

  const agentApiUnavailable: RequestHandler = (_req, res) => res.status(404).json({
    error: 'Agent API is disabled',
    code: AGENT_API_DISABLED_CODE,
  });

  // API Routes
  if (!agentApiEnabled) {
    app.post('/api/auth/register-agent', agentApiUnavailable);
  }
  app.use('/api/auth', authRoutes);
  app.use('/api/users', authMiddleware, userRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/cron', cronRoutes);
  // Admin accounts endpoints (x-admin-secret auth) — registered before the JWT admin routes
  app.use('/api/admin/accounts', adminAuth, adminAccountsRoutes);
  app.use('/api/admin', authMiddleware, adminRoutes);
  // Owner portal operations remain available when the optional Agent API is disabled.
  app.use('/api/owner/leads', authMiddleware, ownerLeadsRoutes);
  app.use('/api/owner', authMiddleware, ownerCollectionsRoutes);

  // Agent HQ routes
  if (agentApiEnabled) {
    app.use('/api/agent/dashboard', authMiddleware, agentDashboardRoutes);
    app.use('/api/agent/contacts', authMiddleware, agentContactRoutes);
    app.use('/api/agent/transactions', authMiddleware, agentTransactionRoutes);
    app.use('/api/agent/properties', authMiddleware, agentPropertyRoutes);
    app.use('/api/agent/listings', authMiddleware, agentListingRoutes);
    app.use('/api/agent/tasks', authMiddleware, agentTaskRoutes);
    app.use('/api/agent/events', authMiddleware, agentEventRoutes);
    app.use('/api/agent/notes', authMiddleware, agentNoteRoutes);
    app.use('/api/agent/market-reports', authMiddleware, agentMarketReportRoutes);
    app.use('/api/agent/ai/actions', authMiddleware, agentActionQueueRoutes);
    app.use('/api/agent/ai', authMiddleware, agentAIRoutes);
    app.use('/api/agent/campaigns', authMiddleware, agentCampaignRoutes);
    app.use('/api/agent/google', authMiddleware, agentGoogleRoutes);
    app.use('/api/agent/inquiries', authMiddleware, agentInquiryRoutes);
    app.use('/api/agent/search', authMiddleware, agentSearchRoutes);
    app.use('/api/agent/reports', authMiddleware, agentReportsRoutes);
    app.use('/api/agent/portals', authMiddleware, requireRole(['AGENT', 'ADMIN']), agentPortalRoutes);
    app.use('/api/agent/segments', authMiddleware, requireRole(['AGENT', 'ADMIN']), agentSegmentRoutes);
    // Compatibility alias for old Agent HQ links. Remove after clients migrate to /api/agent/segments.
    app.use('/api/agent/neighborhoods', authMiddleware, requireRole(['AGENT', 'ADMIN']), agentSegmentRoutes);
    app.use('/api/agent/mls', authMiddleware, agentMlsRoutes);
  } else {
    app.use('/api/agent', agentApiUnavailable);
  }
  app.use('/api/portals', portalPublicRoutes);
  app.use('/api/portals', portalAuthRoutes);
  app.use('/api/email', emailRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Error handling middleware
  app.use(errorHandler);

  return app;
}

const app = createApp();

// Start server
export const startServer = async () => {
  validateEnvironment();

  // Non-fatal: search degrades gracefully if Typesense is down.
  if (isTypesenseConfigured()) {
    ensureCollections().catch(err => {
      logger.error('Typesense collection bootstrap failed:', err);
    });
  }

  await ensureBootstrapAdmin();

  const port = process.env.API_PORT || 3001;
  app.listen(port, () => {
    logger.info(`🚀 API Server running on port ${port}`);
    logger.info(`📊 Health check available at http://localhost:${port}/health`);
  });
};

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  startServer();
}

export default app;
