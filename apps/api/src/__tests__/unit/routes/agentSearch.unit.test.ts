import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  accountMember: { findFirst: vi.fn() },
}));

const mockSearchDocuments = vi.hoisted(() => vi.fn());
const mockIsTypesenseConfigured = vi.hoisted(() => vi.fn());
const mockSearchContactsPg = vi.hoisted(() => vi.fn());
const mockSearchTransactionsPg = vi.hoisted(() => vi.fn());
const mockSearchPropertiesPg = vi.hoisted(() => vi.fn());
const mockSearchTasksPg = vi.hoisted(() => vi.fn());

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../search/index.js', () => ({
  searchDocuments: mockSearchDocuments,
  isTypesenseConfigured: mockIsTypesenseConfigured,
  searchContactsPg: mockSearchContactsPg,
  searchTransactionsPg: mockSearchTransactionsPg,
  searchPropertiesPg: mockSearchPropertiesPg,
  searchTasksPg: mockSearchTasksPg,
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { default: express } = await import('express');
const { default: router } = await import('../../../routes/agentSearch.js');
const { default: request } = await import('supertest');

function buildApp(userId = 'agent1') {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: userId, role: 'AGENT' };
    next();
  });
  app.use('/', router);
  return app;
}

const PG_RESULT = { items: [{ id: 'pg-1' }], total: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.accountMember.findFirst.mockResolvedValue({ accountId: 'acct1' });
  mockSearchContactsPg.mockResolvedValue(PG_RESULT);
  mockSearchTransactionsPg.mockResolvedValue(PG_RESULT);
  mockSearchPropertiesPg.mockResolvedValue(PG_RESULT);
  mockSearchTasksPg.mockResolvedValue(PG_RESULT);
});

describe('GET /api/agent/search — Postgres fallback', () => {
  it('skips Typesense entirely and returns real Postgres results when TYPESENSE_HOST is unset', async () => {
    mockIsTypesenseConfigured.mockReturnValue(false);

    const res = await request(buildApp()).get('/?q=jane');

    expect(res.status).toBe(200);
    expect(mockSearchDocuments).not.toHaveBeenCalled();
    expect(res.body.contacts).toEqual(PG_RESULT);
    expect(res.body.transactions).toEqual(PG_RESULT);
    expect(res.body.properties).toEqual(PG_RESULT);
    expect(res.body.tasks).toEqual(PG_RESULT);
  });

  it('falls back to Postgres per-collection when a Typesense call throws, instead of returning empty', async () => {
    mockIsTypesenseConfigured.mockReturnValue(true);
    mockSearchDocuments.mockRejectedValue(new Error('typesense unreachable'));

    const res = await request(buildApp()).get('/?q=jane');

    expect(res.status).toBe(200);
    expect(res.body.contacts).toEqual(PG_RESULT);
    expect(res.body.contacts.items).not.toEqual([]);
  });

  it('uses Typesense for account collections but always uses non-public Postgres property search', async () => {
    mockIsTypesenseConfigured.mockReturnValue(true);
    mockSearchDocuments.mockResolvedValue({ hits: [{ document: { id: 'ts-1' } }], found: 1 });

    const res = await request(buildApp()).get('/?q=jane');

    expect(res.status).toBe(200);
    expect(res.body.contacts).toEqual({ items: [{ id: 'ts-1' }], total: 1 });
    expect(res.body.properties).toEqual(PG_RESULT);
    expect(mockSearchContactsPg).not.toHaveBeenCalled();
    expect(mockSearchPropertiesPg).toHaveBeenCalledWith({ q: 'jane', limit: 8, publicOnly: false });
    expect(mockSearchDocuments).not.toHaveBeenCalledWith('properties', expect.anything());
  });
});
