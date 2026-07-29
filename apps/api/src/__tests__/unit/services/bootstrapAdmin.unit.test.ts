import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  account: {
    create: vi.fn(),
  },
  accountMember: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mockBcrypt = vi.hoisted(() => ({
  hash: vi.fn(),
}));

vi.mock('db', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../utils/logger.ts', () => ({
  default: mockLogger,
}));

vi.mock('bcrypt', () => ({
  default: mockBcrypt,
}));

const { ensureBootstrapAdmin } = await import('../../../services/bootstrapAdmin.ts');

describe('ensureBootstrapAdmin', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    delete process.env.BOOTSTRAP_ADMIN_ENABLED;
    delete process.env.BOOTSTRAP_ADMIN_FIRST_NAME;
    delete process.env.BOOTSTRAP_ADMIN_LAST_NAME;
    delete process.env.BOOTSTRAP_ADMIN_ACCOUNT_NAME;

    // Default: $transaction immediately invokes the callback with a tx that
    // proxies to the same mock methods.
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('creates Account + User + AccountMember when no admin exists and env is configured', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockBcrypt.hash.mockResolvedValue('hashed-password');
    mockPrisma.account.create.mockResolvedValue({ id: 'acc-1', name: 'System' });
    mockPrisma.user.create.mockResolvedValue({ id: 'usr-1', email: 'admin@realestategear.com' });
    mockPrisma.accountMember.create.mockResolvedValue({ id: 'mem-1' });
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'ADMIN@realestategear.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'very-strong-password';

    await ensureBootstrapAdmin();

    expect(mockPrisma.account.create).toHaveBeenCalledWith({ data: { name: 'System' } });
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'admin@realestategear.com',
        password: 'hashed-password',
        role: 'ADMIN',
        emailVerified: true,
        accountId: 'acc-1',
        portalId: null,
      }),
      select: { id: true, email: true },
    });
    expect(mockPrisma.accountMember.create).toHaveBeenCalledWith({
      data: { accountId: 'acc-1', userId: 'usr-1', role: 'OWNER' },
    });
  });

  it('uses BOOTSTRAP_ADMIN_ACCOUNT_NAME when provided', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockBcrypt.hash.mockResolvedValue('hashed-password');
    mockPrisma.account.create.mockResolvedValue({ id: 'acc-2', name: 'Real Estate Gear HQ' });
    mockPrisma.user.create.mockResolvedValue({ id: 'usr-2', email: 'a@a.com' });
    mockPrisma.accountMember.create.mockResolvedValue({ id: 'mem-2' });
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'a@a.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'very-strong-password';
    process.env.BOOTSTRAP_ADMIN_ACCOUNT_NAME = 'Real Estate Gear HQ';

    await ensureBootstrapAdmin();

    expect(mockPrisma.account.create).toHaveBeenCalledWith({ data: { name: 'Real Estate Gear HQ' } });
  });

  it('does not create when an admin already exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-1', email: 'a@a.com' });

    await ensureBootstrapAdmin();

    expect(mockPrisma.account.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.accountMember.create).not.toHaveBeenCalled();
  });

  it('does not create when credentials are missing', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await ensureBootstrapAdmin();

    expect(mockPrisma.account.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});
