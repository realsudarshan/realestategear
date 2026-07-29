import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  mlsAgent: { findMany: vi.fn() },
  accountMlsAccess: { upsert: vi.fn(), findMany: vi.fn(), update: vi.fn() },
}));
const mockGetAccountEmailTarget = vi.hoisted(() => vi.fn());
const mockSendInternalMlsStatusFlaggedAlert = vi.hoisted(() => vi.fn());

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../services/lifecycleEmailService.js', () => ({
  getAccountEmailTarget: mockGetAccountEmailTarget,
  sendInternalMlsStatusFlaggedAlert: mockSendInternalMlsStatusFlaggedAlert,
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { verifyAndLinkMlsAccess, checkMlsStatuses } = await import('../../../services/mlsVerificationService.js');

const config = { providerId: 'mlsgrid', mlsBoardId: 'CanopyMLS' };

describe('verifyAndLinkMlsAccess (D8)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an empty / whitespace MLS id without querying', async () => {
    expect(await verifyAndLinkMlsAccess('acc1', '   ', config)).toEqual({ status: 'invalid' });
    expect(mockPrisma.mlsAgent.findMany).not.toHaveBeenCalled();
  });

  it('returns not_found when the roster has no match', async () => {
    mockPrisma.mlsAgent.findMany.mockResolvedValue([]);
    expect(await verifyAndLinkMlsAccess('acc1', '12345', config)).toEqual({ status: 'not_found' });
    expect(mockPrisma.accountMlsAccess.upsert).not.toHaveBeenCalled();
  });

  it('returns ambiguous (and writes nothing) when multiple rows match', async () => {
    mockPrisma.mlsAgent.findMany.mockResolvedValue([
      { id: 'a', status: 'Active', name: 'A', email: null },
      { id: 'b', status: 'Active', name: 'B', email: null },
    ]);
    const result = await verifyAndLinkMlsAccess('acc1', '12345', config);
    expect(result.status).toBe('ambiguous');
    expect(mockPrisma.accountMlsAccess.upsert).not.toHaveBeenCalled();
  });

  it('returns inactive (and writes nothing) for a non-active agent', async () => {
    mockPrisma.mlsAgent.findMany.mockResolvedValue([
      { id: 'a', status: 'Inactive', name: 'Jane', email: 'j@x.com' },
    ]);
    const result = await verifyAndLinkMlsAccess('acc1', '12345', config);
    expect(result.status).toBe('inactive');
    expect(result.agent).toEqual({ name: 'Jane', email: 'j@x.com' });
    expect(mockPrisma.accountMlsAccess.upsert).not.toHaveBeenCalled();
  });

  it('verifies an active agent and records AccountMlsAccess', async () => {
    mockPrisma.mlsAgent.findMany.mockResolvedValue([
      { id: 'a', status: 'Active', name: 'Jane', email: 'j@x.com' },
    ]);
    mockPrisma.accountMlsAccess.upsert.mockResolvedValue({ id: 'access1' });

    const result = await verifyAndLinkMlsAccess('acc1', '12345', config);

    expect(result.status).toBe('verified');
    expect(result.accessId).toBe('access1');
    expect(mockPrisma.accountMlsAccess.upsert).toHaveBeenCalledOnce();
    const arg = mockPrisma.accountMlsAccess.upsert.mock.calls[0][0];
    expect(arg.where.accountId_mlsBoardId).toEqual({ accountId: 'acc1', mlsBoardId: 'CanopyMLS' });
    expect(arg.create.membershipId).toBe('12345');
    expect(arg.create.verifiedAt).toBeInstanceOf(Date);
  });

  it('strips the board prefix from the submitted id before matching and storing', async () => {
    mockPrisma.mlsAgent.findMany.mockResolvedValue([
      { id: 'a', status: 'Active', name: 'Jane', email: 'j@x.com' },
    ]);
    mockPrisma.accountMlsAccess.upsert.mockResolvedValue({ id: 'access1' });

    const prefixedConfig = { ...config, prefix: 'ACT' };
    const result = await verifyAndLinkMlsAccess('acc1', 'ACT12345', prefixedConfig);

    expect(result.status).toBe('verified');
    expect(mockPrisma.mlsAgent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerId: 'mlsgrid', mlsId: '12345' } }),
    );
    const arg = mockPrisma.accountMlsAccess.upsert.mock.calls[0][0];
    expect(arg.create.membershipId).toBe('12345');
  });

  it('is a no-op prefix-strip when the board has no prefix configured', async () => {
    mockPrisma.mlsAgent.findMany.mockResolvedValue([]);
    await verifyAndLinkMlsAccess('acc1', '12345', config);
    expect(mockPrisma.mlsAgent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerId: 'mlsgrid', mlsId: '12345' } }),
    );
  });

  it('fails loud when config is omitted and MLS_BOARD_ID is not set', async () => {
    const original = process.env.MLS_BOARD_ID;
    delete process.env.MLS_BOARD_ID;
    try {
      await expect(verifyAndLinkMlsAccess('acc1', '12345')).rejects.toThrow('MLS_BOARD_ID is not set');
    } finally {
      if (original === undefined) delete process.env.MLS_BOARD_ID;
      else process.env.MLS_BOARD_ID = original;
    }
  });
});

describe('checkMlsStatuses (#205)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fails loud when config is omitted and MLS_BOARD_ID is not set', async () => {
    const original = process.env.MLS_BOARD_ID;
    delete process.env.MLS_BOARD_ID;
    try {
      await expect(checkMlsStatuses()).rejects.toThrow('MLS_BOARD_ID is not set');
    } finally {
      if (original === undefined) delete process.env.MLS_BOARD_ID;
      else process.env.MLS_BOARD_ID = original;
    }
  });

  it('returns all zeros with no queries when there are no access rows', async () => {
    mockPrisma.accountMlsAccess.findMany.mockResolvedValue([]);
    const result = await checkMlsStatuses(config);
    expect(result).toEqual({ checked: 0, newlyFlagged: 0, cleared: 0, ambiguous: 0 });
    expect(mockPrisma.mlsAgent.findMany).not.toHaveBeenCalled();
  });

  it('flags a newly-inactive agent and sends the internal alert', async () => {
    mockPrisma.accountMlsAccess.findMany.mockResolvedValue([
      { id: 'access1', accountId: 'acc1', membershipId: '12345', flaggedInactiveAt: null },
    ]);
    mockPrisma.mlsAgent.findMany.mockResolvedValue([
      { mlsId: '12345', status: 'Inactive', name: 'Jane', email: 'j@x.com' },
    ]);
    mockGetAccountEmailTarget.mockResolvedValue({ id: 'acc1', name: 'Smith Realty' });

    const result = await checkMlsStatuses(config);

    expect(result).toEqual({ checked: 1, newlyFlagged: 1, cleared: 0, ambiguous: 0 });
    expect(mockPrisma.accountMlsAccess.update).toHaveBeenCalledWith({
      where: { id: 'access1' },
      data: { flaggedInactiveAt: expect.any(Date) },
    });
    expect(mockSendInternalMlsStatusFlaggedAlert).toHaveBeenCalledWith(
      { id: 'acc1', name: 'Smith Realty' },
      { membershipId: '12345', agentName: 'Jane', flaggedAt: expect.any(Date) },
    );
  });

  it('does not re-flag or re-alert an already-flagged agent', async () => {
    const flaggedInactiveAt = new Date('2026-06-01');
    mockPrisma.accountMlsAccess.findMany.mockResolvedValue([
      { id: 'access1', accountId: 'acc1', membershipId: '12345', flaggedInactiveAt },
    ]);
    mockPrisma.mlsAgent.findMany.mockResolvedValue([
      { mlsId: '12345', status: 'Inactive', name: 'Jane', email: 'j@x.com' },
    ]);

    const result = await checkMlsStatuses(config);

    expect(result).toEqual({ checked: 1, newlyFlagged: 0, cleared: 0, ambiguous: 0 });
    expect(mockPrisma.accountMlsAccess.update).not.toHaveBeenCalled();
    expect(mockSendInternalMlsStatusFlaggedAlert).not.toHaveBeenCalled();
  });

  it('clears the flag when a previously-flagged agent is active again', async () => {
    mockPrisma.accountMlsAccess.findMany.mockResolvedValue([
      { id: 'access1', accountId: 'acc1', membershipId: '12345', flaggedInactiveAt: new Date('2026-06-01') },
    ]);
    mockPrisma.mlsAgent.findMany.mockResolvedValue([
      { mlsId: '12345', status: 'Active', name: 'Jane', email: 'j@x.com' },
    ]);

    const result = await checkMlsStatuses(config);

    expect(result).toEqual({ checked: 1, newlyFlagged: 0, cleared: 1, ambiguous: 0 });
    expect(mockPrisma.accountMlsAccess.update).toHaveBeenCalledWith({
      where: { id: 'access1' },
      data: { flaggedInactiveAt: null },
    });
    expect(mockSendInternalMlsStatusFlaggedAlert).not.toHaveBeenCalled();
  });

  it('treats a roster miss (no matching agent) as inactive and flags it', async () => {
    mockPrisma.accountMlsAccess.findMany.mockResolvedValue([
      { id: 'access1', accountId: 'acc1', membershipId: '99999', flaggedInactiveAt: null },
    ]);
    mockPrisma.mlsAgent.findMany.mockResolvedValue([]);
    mockGetAccountEmailTarget.mockResolvedValue({ id: 'acc1', name: 'Smith Realty' });

    const result = await checkMlsStatuses(config);

    expect(result.newlyFlagged).toBe(1);
    expect(mockSendInternalMlsStatusFlaggedAlert).toHaveBeenCalledWith(
      { id: 'acc1', name: 'Smith Realty' },
      { membershipId: '99999', agentName: undefined, flaggedAt: expect.any(Date) },
    );
  });

  it('skips ambiguous roster matches without touching the flag', async () => {
    mockPrisma.accountMlsAccess.findMany.mockResolvedValue([
      { id: 'access1', accountId: 'acc1', membershipId: '12345', flaggedInactiveAt: null },
    ]);
    mockPrisma.mlsAgent.findMany.mockResolvedValue([
      { mlsId: '12345', status: 'Active', name: 'Jane', email: 'j@x.com' },
      { mlsId: '12345', status: 'Active', name: 'Jane Two', email: 'j2@x.com' },
    ]);

    const result = await checkMlsStatuses(config);

    expect(result).toEqual({ checked: 1, newlyFlagged: 0, cleared: 0, ambiguous: 1 });
    expect(mockPrisma.accountMlsAccess.update).not.toHaveBeenCalled();
    expect(mockSendInternalMlsStatusFlaggedAlert).not.toHaveBeenCalled();
  });
});
