import { vi, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp, closeTestApp, getPrismaClient } from '../utils/testApp.js';
import { clearDatabase, seedDatabase, createAuthHeaders, hashPassword } from '../utils/testHelpers.js';
import { mockValidRegistrationData, mockValidLoginData } from '../utils/fixtures.js';

describe('Auth Routes - integration tests', () => {
  let app;
  let prisma;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register-agent', () => {
    const agentRegistrationData = {
      email: 'agent@example.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith',
      accountName: 'Smith Realty',
      plan: 'pro',
    };

    it('should register a new agent successfully, creating Account + AccountMember', async () => {
      const response = await request(app)
        .post('/api/auth/register-agent')
        .send(agentRegistrationData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Agent registered successfully');
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(agentRegistrationData.email);
      expect(response.body.user.role).toBe('AGENT');
      expect(response.body.user.password).toBeUndefined();

      // Verify the Account and AccountMember were created.
      const user = await prisma.user.findFirst({ where: { email: agentRegistrationData.email } });
      expect(user).toBeTruthy();
      expect(user.accountId).toBeTruthy();
      expect(user.portalId).toBeNull();

      const account = await prisma.account.findUnique({ where: { id: user.accountId } });
      expect(account.name).toBe('Smith Realty');

      const member = await prisma.accountMember.findFirst({
        where: { accountId: user.accountId, userId: user.id },
      });
      expect(member).toBeTruthy();
      expect(member.role).toBe('OWNER');
    });

    it('should reject registration with missing email', async () => {
      const invalidData = { ...agentRegistrationData };
      delete invalidData.email;

      const response = await request(app)
        .post('/api/auth/register-agent')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.body).toContain('"email" is required');
    });

    it('should reject registration with invalid email format', async () => {
      const invalidData = { ...agentRegistrationData, email: 'invalid-email' };

      const response = await request(app)
        .post('/api/auth/register-agent')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.body).toContain('"email" must be a valid email');
    });

    it('should reject registration with short password', async () => {
      const invalidData = { ...agentRegistrationData, password: '123' };

      const response = await request(app)
        .post('/api/auth/register-agent')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.body).toContain('"password" length must be at least 8 characters long');
    });

    it('should reject registration with duplicate agent email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register-agent')
        .send(agentRegistrationData);

      // Second registration with same email (and different accountName so we
      // know it's the email collision, not anything else).
      const response = await request(app)
        .post('/api/auth/register-agent')
        .send({ ...agentRegistrationData, accountName: 'Other Realty' });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/already exists/i);
    });

    it('should hash password before storing', async () => {
      await request(app)
        .post('/api/auth/register-agent')
        .send(agentRegistrationData);

      const user = await prisma.user.findFirst({
        where: { email: agentRegistrationData.email },
      });

      expect(user.password).not.toBe(agentRegistrationData.password);
      expect(user.password).toMatch(/^\$2[aby]\$\d{1,2}\$.{53}$/); // bcrypt hash pattern
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create an Account + agent-space User (portalId: null) for login tests.
      const hashedPassword = await hashPassword(mockValidLoginData.password);
      const account = await prisma.account.create({ data: { name: 'Login Test Account' } });
      await prisma.user.create({
        data: {
          email: mockValidLoginData.email,
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'User',
          role: 'AGENT',
          accountId: account.id,
          portalId: null,
        }
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(mockValidLoginData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(mockValidLoginData.email);
      expect(response.body.user.password).toBeUndefined();
    });

    it('should reject login with invalid email', async () => {
      const invalidData = { ...mockValidLoginData, email: 'nonexistent@example.com' };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const invalidData = { ...mockValidLoginData, password: 'wrongpassword' };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with missing email', async () => {
      const invalidData = { password: mockValidLoginData.password };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.body).toContain('"email" is required');
    });

    it('should reject login with missing password', async () => {
      const invalidData = { email: mockValidLoginData.email };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.body).toContain('"password" is required');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      // Create an Account + User for forgot password tests
      const hashedPassword = await hashPassword('password123');
      const account = await prisma.account.create({ data: { name: 'Forgot Test Account' } });
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'User',
          role: 'AGENT',
          accountId: account.id,
          portalId: null,
        }
      });
    });

    it('should handle forgot password request for existing user', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password reset instructions sent to email');
    });

    it('should handle forgot password request for non-existing user', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      // Should return success to avoid user enumeration
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password reset instructions sent to email');
    });

    it('should reject forgot password with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.body).toContain('"email" must be a valid email');
    });

    it('should reject forgot password with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.body).toContain('"email" is required');
    });
  });

  describe('GET /api/auth/me', () => {
    let userToken;
    let testUser;

    beforeEach(async () => {
      // Create user and get token
      const { user } = await seedDatabase(prisma);
      testUser = user;

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        });

      userToken = loginResponse.body.token;
    });

    it('should return user profile for authenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set(createAuthHeaders(userToken));

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.password).toBeUndefined();
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No authorization header provided');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set(createAuthHeaders('invalid-token'));

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('GET /api/auth/google/start', () => {
    const originalClientId = process.env.GOOGLE_WEB_CLIENT_ID;
    const originalClientSecret = process.env.GOOGLE_WEB_CLIENT_SECRET;
    const originalAgentHqUrl = process.env.AGENT_HQ_URL;
    const originalFrontendUrl = process.env.FRONTEND_URL;

    beforeEach(() => {
      process.env.GOOGLE_WEB_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_WEB_CLIENT_SECRET = 'test-client-secret';
      process.env.AGENT_HQ_URL = 'http://localhost:3002';
      process.env.FRONTEND_URL = 'http://localhost:3000';
    });

    afterEach(() => {
      process.env.GOOGLE_WEB_CLIENT_ID = originalClientId;
      process.env.GOOGLE_WEB_CLIENT_SECRET = originalClientSecret;
      process.env.AGENT_HQ_URL = originalAgentHqUrl;
      process.env.FRONTEND_URL = originalFrontendUrl;
    });

    it('should redirect to Google for purpose=agent with a matching callback_base', async () => {
      const response = await request(app)
        .get('/api/auth/google/start')
        .query({ purpose: 'agent', callback_base: 'http://localhost:3002' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('accounts.google.com');
    });

    it('should reject purpose=agent with a mismatched callback_base instead of falling back', async () => {
      const response = await request(app)
        .get('/api/auth/google/start')
        .query({ purpose: 'agent', callback_base: 'http://localhost:3000' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_callback_base');
    });

    it('should reject purpose=agent with an attacker-controlled callback_base', async () => {
      const response = await request(app)
        .get('/api/auth/google/start')
        .query({ purpose: 'agent', callback_base: 'https://evil.example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_callback_base');
    });

    it('should redirect to Google for purpose=portal with a matching callback_base', async () => {
      const response = await request(app)
        .get('/api/auth/google/start')
        .query({ purpose: 'portal', callback_base: 'http://localhost:3000' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('accounts.google.com');
    });

    it('should reject purpose=portal with a mismatched (agent-hq) callback_base instead of falling back', async () => {
      const response = await request(app)
        .get('/api/auth/google/start')
        .query({ purpose: 'portal', callback_base: 'http://localhost:3002' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_callback_base');
    });
  });
});