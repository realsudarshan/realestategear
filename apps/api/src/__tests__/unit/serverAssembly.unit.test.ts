import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { default: express } = await import('express');

const emptyRouteModules = [
  'users',
  'properties',
  'search',
  'admin',
  'adminAccounts',
  'contact',
  'cron',
  'agentDashboard',
  'agentContacts',
  'agentTransactions',
  'agentProperties',
  'agentListings',
  'agentTasks',
  'agentEvents',
  'agentNotes',
  'agentMarketReports',
  'agentAI',
  'agentActionQueue',
  'agentCampaigns',
  'agentGoogle',
  'agentInquiries',
  'agentReports',
  'agentPortals',
  'agentSearch',
  'agentSegments',
  'agentMls',
  'email',
  'ownerLeads',
];

for (const routeModule of emptyRouteModules) {
  vi.doMock(`../../routes/${routeModule}.js`, () => ({ default: express.Router() }));
}

vi.doMock('../../routes/auth.js', () => {
  const router = express.Router();
  router.post('/login', (_req, res) => res.json({ message: 'Login route available' }));
  router.post('/register-agent', (_req, res) => res.status(201).json({ message: 'Agent registered' }));
  return { default: router };
});

vi.doMock('../../routes/portalPublic.js', () => ({ default: express.Router() }));
vi.doMock('../../routes/portalAuth.js', () => {
  const router = express.Router();
  router.post('/portal-test/auth/login', (_req, res) => res.json({ message: 'Portal login route available' }));
  return { default: router };
});

vi.doMock('../../services/bootstrapAdmin.js', () => ({ ensureBootstrapAdmin: vi.fn() }));
vi.doMock('../../search/index.js', () => ({ ensureCollections: vi.fn(), isTypesenseConfigured: vi.fn(() => false) }));
vi.doMock('../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
const listenSpy = vi.spyOn(express.application, 'listen');
const {
  AGENT_API_DISABLED_CODE,
  createApp,
  parseAgentApiEnabled,
} = await import('../../server.js');

describe('API assembly', () => {
  afterEach(() => {
    delete process.env.AGENT_API_ENABLED;
  });

  it('does not validate the startup environment or listen when imported', () => {
    expect(exitSpy).not.toHaveBeenCalled();
    expect(listenSpy).not.toHaveBeenCalled();
  });

  it('enables the agent API only for the literal value true', () => {
    expect(parseAgentApiEnabled(undefined)).toBe(false);
    expect(parseAgentApiEnabled('')).toBe(false);
    expect(parseAgentApiEnabled('TRUE')).toBe(false);
    expect(parseAgentApiEnabled('1')).toBe(false);
    expect(parseAgentApiEnabled('true')).toBe(true);
  });

  it('fails closed for agent routes and registration by default while shared auth remains mounted', async () => {
    const app = createApp();

    const [agent, registration, login, portalLogin, ownerLeads] = await Promise.all([
      request(app).get('/api/agent/dashboard'),
      request(app).post('/api/auth/register-agent').send({}),
      request(app).post('/api/auth/login').send({}),
      request(app).post('/api/portals/portal-test/auth/login').send({}),
      request(app).get('/api/owner/leads'),
    ]);

    expect(agent.status).toBe(404);
    expect(agent.body.code).toBe(AGENT_API_DISABLED_CODE);
    expect(registration.status).toBe(404);
    expect(registration.body.code).toBe(AGENT_API_DISABLED_CODE);
    expect(login.status).toBe(200);
    expect(portalLogin.status).toBe(200);
    expect(ownerLeads.status).toBe(401);
    expect(ownerLeads.body.error).toBe('No authorization header provided');
  });

  it('mounts agent routes and registration when explicitly enabled', async () => {
    process.env.AGENT_API_ENABLED = 'true';
    const app = createApp();

    const [agent, registration] = await Promise.all([
      request(app).get('/api/agent/dashboard'),
      request(app).post('/api/auth/register-agent').send({}),
    ]);

    expect(agent.status).toBe(401);
    expect(agent.body.error).toBe('No authorization header provided');
    expect(registration.status).toBe(201);
  });
});
