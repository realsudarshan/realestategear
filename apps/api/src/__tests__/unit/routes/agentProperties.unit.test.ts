import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getProperties: vi.fn(),
  searchProperties: vi.fn(),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../../services/propertyService.js', () => mocks);

const { default: express } = await import('express');
const { default: request } = await import('supertest');
const { default: router } = await import('../../../routes/agentProperties.js');

describe('agent property catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProperties.mockResolvedValue({ properties: [], pagination: {} });
  });

  it('explicitly requests non-public MLS access', async () => {
    const app = express();
    app.use('/', router);

    const response = await request(app).get('/').query({ search: 'main' });

    expect(response.status).toBe(200);
    expect(mocks.getProperties).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'main' }),
      { publicOnly: false },
    );
  });
});
