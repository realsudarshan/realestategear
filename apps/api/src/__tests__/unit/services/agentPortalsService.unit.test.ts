import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  portal: {
    findUnique: vi.fn(),
  },
  accountMember: {
    findFirst: vi.fn(),
  },
}));

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: vi.fn(), PutObjectCommand: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn().mockResolvedValue('https://presigned-url') }));

const { validateSlug, checkOwnership, validateActivation } = await import('../../../services/agentPortalsService.js');

describe('agentPortalsService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('validateSlug', () => {
    it('returns null for valid slugs', () => {
      expect(validateSlug('myrtle-beach')).toBeNull();
      expect(validateSlug('abc123')).toBeNull();
      expect(validateSlug('a')).toBeNull();
    });

    it('rejects reserved slugs', () => {
      expect(validateSlug('www')).toMatch(/reserved/);
      expect(validateSlug('api')).toMatch(/reserved/);
      expect(validateSlug('app')).toMatch(/reserved/);
      expect(validateSlug('admin')).toMatch(/reserved/);
      expect(validateSlug('mail')).toMatch(/reserved/);
      expect(validateSlug('portal')).toMatch(/reserved/);
    });

    it('rejects slugs with invalid characters', () => {
      expect(validateSlug('My-Portal')).toMatch(/lowercase/);
      expect(validateSlug('my portal')).toMatch(/lowercase/);
      expect(validateSlug('my_portal')).toMatch(/lowercase/);
    });

    it('rejects empty slug', () => {
      expect(validateSlug('')).toMatch(/required/i);
    });
  });

  describe('checkOwnership', () => {
    it('returns portal when agent is owner', async () => {
      mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', accountId: 'acc1' });
      mockPrisma.accountMember.findFirst.mockResolvedValue({ id: 'mem1' });
      const portal = await checkOwnership('p1', 'a1');
      expect(portal).toEqual({ id: 'p1', accountId: 'acc1' });
    });

    it('throws 404 when portal not found', async () => {
      mockPrisma.portal.findUnique.mockResolvedValue(null);
      await expect(checkOwnership('p-missing', 'a1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when agent is not owner', async () => {
      mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', accountId: 'acc1' });
      mockPrisma.accountMember.findFirst.mockResolvedValue(null);
      await expect(checkOwnership('p1', 'a1')).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('validateActivation', () => {
    it('returns null when slug and agentEmail are present', async () => {
      const result = await validateActivation({ slug: 'my-portal', agentEmail: 'agent@example.com' });
      expect(result).toBeNull();
    });

    it('returns error when slug is missing', async () => {
      const result = await validateActivation({ slug: '', agentEmail: 'agent@example.com' });
      expect(result).toMatch(/slug/i);
    });

    it('returns error when agentEmail is missing', async () => {
      const result = await validateActivation({ slug: 'my-portal', agentEmail: null });
      expect(result).toMatch(/email/i);
    });
  });
});
