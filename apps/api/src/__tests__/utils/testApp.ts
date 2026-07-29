import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { PrismaClient } from 'db';
import { PrismaPg } from '@prisma/adapter-pg';

// Import routes
import authRoutes from '../../routes/auth.js';
import userRoutes from '../../routes/users.js';
import propertyRoutes from '../../routes/properties.js';
import searchRoutes from '../../routes/search.js';
import contactRoutes from '../../routes/contact.js';
import cronRoutes from '../../routes/cron.js';
import adminRoutes from '../../routes/admin.js';
import agentListingRoutes from '../../routes/agentListings.js';

import { authMiddleware } from '../../middleware/auth.js';
import { errorHandler } from '../../middleware/errorHandler.js';

let testApp = null;
let prisma = null;

export const createTestApp = async () => {
  if (testApp) {
    return { app: testApp, prisma };
  }

  const app = express();

  // Initialize Prisma client for testing (separate instance so tests can disconnect)
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  prisma = new PrismaClient({ adapter });

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }));
  app.use(compression());

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(500).json({ status: 'unhealthy', error: error.message });
    }
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', authMiddleware, userRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/cron', cronRoutes);
  app.use('/api/admin', authMiddleware, adminRoutes);
  app.use('/api/agent/listings', authMiddleware, agentListingRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Error handling middleware
  app.use(errorHandler);

  testApp = app;
  return { app, prisma };
};

export const closeTestApp = async () => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
  testApp = null;
};

export const getPrismaClient = () => prisma;
