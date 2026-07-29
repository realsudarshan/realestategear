import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  mlsAgent: { upsert: vi.fn() },
  mlsOffice: { upsert: vi.fn() },
}));

vi.mock('db', () => ({ prisma: mockPrisma }));

const { upsertAgent, upsertOffice } = await import('../../../src/sync/roster.js');

const cfg = { providerId: 'mlsgrid', prefix: 'CANOPY' };

describe('upsertAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false and skips DB write when MemberKey is absent', async () => {
    expect(await upsertAgent({} as never, cfg)).toBe(false);
    expect(mockPrisma.mlsAgent.upsert).not.toHaveBeenCalled();
  });

  it('upserts and returns true for a valid record', async () => {
    mockPrisma.mlsAgent.upsert.mockResolvedValue({});
    const result = await upsertAgent(
      {
        MemberKey: 'CANOPY123',
        MemberMlsId: 'CANOPY456',
        MemberFirstName: 'Jane',
        MemberLastName: 'Smith',
        MemberFullName: 'Jane Smith',
        MemberEmail: 'jane@example.com',
        MemberMobilePhone: '704-555-0001',
        MemberStateLicense: 'NC123',
        MemberStatus: 'Active',
        OfficeKey: 'OFF001',
        OfficeMlsId: 'CANOPYOFF001',
        ModificationTimestamp: '2026-06-01T00:00:00.000Z',
      } as never,
      cfg,
    );
    expect(result).toBe(true);
    const call = mockPrisma.mlsAgent.upsert.mock.calls[0][0];
    // mlsId stored de-prefixed (D17)
    expect(call.create.mlsId).toBe('456');
    expect(call.create.providerId).toBe('mlsgrid');
    expect(call.create.externalId).toBe('CANOPY123');
  });

  it('stores null mlsId when MemberMlsId is absent', async () => {
    mockPrisma.mlsAgent.upsert.mockResolvedValue({});
    await upsertAgent({ MemberKey: 'CANOPY789' } as never, cfg);
    const call = mockPrisma.mlsAgent.upsert.mock.calls[0][0];
    expect(call.create.mlsId).toBeNull();
  });
});

describe('upsertOffice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false and skips DB write when OfficeKey is absent', async () => {
    expect(await upsertOffice({} as never, cfg)).toBe(false);
    expect(mockPrisma.mlsOffice.upsert).not.toHaveBeenCalled();
  });

  it('upserts and returns true for a valid record', async () => {
    mockPrisma.mlsOffice.upsert.mockResolvedValue({});
    const result = await upsertOffice(
      {
        OfficeKey: 'CANOPYOFF1',
        OfficeMlsId: 'CANOPYOFF001',
        OfficeName: 'Acme Realty',
        OfficePhone: '704-555-0002',
        OfficeAddress1: '100 Main St',
        OfficeCity: 'Charlotte',
        OfficePostalCode: '28201',
        OfficeStatus: 'Active',
        ModificationTimestamp: '2026-06-01T00:00:00.000Z',
      } as never,
      cfg,
    );
    expect(result).toBe(true);
    const call = mockPrisma.mlsOffice.upsert.mock.calls[0][0];
    expect(call.create.mlsId).toBe('OFF001');
    expect(call.create.name).toBe('Acme Realty');
  });

  it('stores null mlsId when OfficeMlsId is absent', async () => {
    mockPrisma.mlsOffice.upsert.mockResolvedValue({});
    await upsertOffice({ OfficeKey: 'OFF_BARE' } as never, cfg);
    const call = mockPrisma.mlsOffice.upsert.mock.calls[0][0];
    expect(call.create.mlsId).toBeNull();
  });
});
