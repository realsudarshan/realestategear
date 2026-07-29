import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  transaction: {
    findMany: vi.fn(),
  },
}));

vi.mock('db', () => ({
  prisma: mockPrisma,
}));

const { getReportSummary, getReportForecast } = await import('../services/reportsService.ts');

describe('reportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes summary metrics and commission math with missing values', async () => {
    mockPrisma.transaction.findMany
      .mockResolvedValueOnce([
        { salePrice: 500000, commissionRate: 3 },
        { salePrice: 300000, commissionRate: null },
        { salePrice: null, commissionRate: 2.5 },
      ])
      .mockResolvedValueOnce([{ salePrice: 250000, commissionRate: 3 }]);

    const result = await getReportSummary('agent-1', 'AGENT', {
      from: '2026-01-01',
      to: '2026-01-31',
      type: 'BUY',
    });

    expect(result.closings).toBe(3);
    expect(result.volume).toBe(800000);
    expect(result.commission).toBeCloseTo(15000, 3);
    expect(result.missingDataCount).toBe(2);
    expect(result.prev.closings).toBe(1);
    expect(result.prev.volume).toBe(250000);
    expect(result.prev.commission).toBeCloseTo(7500, 3);
  });

  it('applies agent scoping and type filter for AGENT role', async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getReportSummary('agent-2', 'AGENT', {
      from: '2026-02-01',
      to: '2026-02-28',
      type: 'SELL',
    });

    const firstCallArgs = mockPrisma.transaction.findMany.mock.calls[0][0];
    expect(firstCallArgs.where.type).toBe('SELL');
    expect(firstCallArgs.where.assignedAgentId).toBe('agent-2');
    expect(firstCallArgs.where.OR).toBeUndefined();
  });

  it('does not apply agent scoping for ADMIN role', async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getReportSummary('admin-1', 'ADMIN', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    const firstCallArgs = mockPrisma.transaction.findMany.mock.calls[0][0];
    expect(firstCallArgs.where.OR).toBeUndefined();
  });

  it('computes weighted pipeline forecast totals by stage', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      { stage: 'PROSPECT', salePrice: 100000, commissionRate: 3 },
      { stage: 'SIGNED', salePrice: 200000, commissionRate: 2.5 },
      { stage: 'PENDING', salePrice: 300000, commissionRate: 3 },
      { stage: 'LISTED', salePrice: null, commissionRate: null },
    ]);

    const result = await getReportForecast('agent-3', 'AGENT', { type: 'BUY' });

    expect(result.projectedClosings).toBeCloseTo(1.85, 5);
    expect(result.projectedVolume).toBeCloseTo(345000, 5);
    expect(result.projectedCommission).toBeCloseTo(9950, 5);
    expect(result.byStage).toHaveLength(4);
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'BUY',
          stage: { in: ['PROSPECT', 'SIGNED', 'LISTED', 'PENDING'] },
        }),
      })
    );
  });
});
