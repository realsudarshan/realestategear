import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  task: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

const taskServicePath = new URL('../../../services/taskService.js', import.meta.url).href;

vi.mock('db', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../search/index.js', () => ({
  upsertDocument: vi.fn(),
  deleteDocument: vi.fn(),
  toTaskDoc: vi.fn((t) => t),
}));

vi.mock('../../../services/contactActivityDenormService.js', () => ({
  refresh: vi.fn(),
}));

const { getTasks } = await import(taskServicePath);

describe('taskService.getTasks — search filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.task.count.mockResolvedValue(0);
  });

  it('does not add an OR clause when search is absent', async () => {
    await getTasks('user-1', { page: 1, limit: 10 });
    const whereArg = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg).toEqual({ assignedToId: 'user-1' });
    expect(whereArg.OR).toBeUndefined();
  });

  it('ignores search strings shorter than 2 characters', async () => {
    await getTasks('user-1', { search: 'a' });
    const whereArg = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeUndefined();
  });

  it('ignores whitespace-only search strings', async () => {
    await getTasks('user-1', { search: '   ' });
    const whereArg = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeUndefined();
  });

  it('builds an OR clause matching task title and description', async () => {
    await getTasks('user-1', { search: 'follow up' });
    const whereArg = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg.assignedToId).toBe('user-1');
    expect(whereArg.OR).toEqual([
      { title: { contains: 'follow up', mode: 'insensitive' } },
      { description: { contains: 'follow up', mode: 'insensitive' } },
    ]);
  });

  it('trims surrounding whitespace from the search query', async () => {
    await getTasks('user-1', { search: '  call  ' });
    const whereArg = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg.OR[0].title.contains).toBe('call');
    expect(whereArg.OR[1].description.contains).toBe('call');
  });

  it('uses Prisma case-insensitive mode for every contains filter', async () => {
    await getTasks('user-1', { search: 'inspection' });
    const whereArg = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg.OR[0].title.mode).toBe('insensitive');
    expect(whereArg.OR[1].description.mode).toBe('insensitive');
  });

  it('combines search with existing status and priority filters', async () => {
    await getTasks('user-1', { search: 'inspection', status: 'OPEN', priority: 'HIGH' });
    const whereArg = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(whereArg).toMatchObject({
      assignedToId: 'user-1',
      status: 'OPEN',
      priority: 'HIGH',
    });
    expect(whereArg.OR).toBeDefined();
  });
});
