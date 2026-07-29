import { expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { mockUser, mockAdminUser, mockJWTPayload, mockAdminJWTPayload } from './fixtures.js';

export const createAuthToken = (payload: Record<string, unknown> = mockJWTPayload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only');
};

export const createAdminAuthToken = (payload: Record<string, unknown> = mockAdminJWTPayload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only');
};

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

export const createAuthHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
});

export const createMockReq = (overrides = {}) => ({
  headers: {},
  body: {},
  query: {},
  params: {},
  user: null,
  ...overrides
});

export const createMockRes = () => {
  const res: Record<string, any> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res;
};

export const createMockNext = () => vi.fn();

export const clearDatabase = async (prisma) => {
  // Clear database in correct order to avoid foreign key constraints.
  // UserFavorites and Inquiry have FKs to both User and Listing,
  // so they must be deleted before either parent table.
  await prisma.userFavorites.deleteMany();
  await prisma.inquiryDelivery.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.savedSearch.deleteMany();
  await prisma.property.deleteMany();
  await prisma.accountMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();
};

export const seedDatabase = async (prisma) => {
  // Clear existing data
  await clearDatabase(prisma);

  // Each User now requires an accountId. Create one Account per seed user.
  const hashedPassword = await hashPassword('password123');

  const userAccount = await prisma.account.create({ data: { name: 'Test User Account' } });
  const user = await prisma.user.create({
    data: {
      ...mockUser,
      password: hashedPassword,
      accountId: userAccount.id,
      portalId: null,
    },
  });

  const adminAccount = await prisma.account.create({ data: { name: 'Test Admin Account' } });
  const adminUser = await prisma.user.create({
    data: {
      ...mockAdminUser,
      password: hashedPassword,
      accountId: adminAccount.id,
      portalId: null,
    },
  });

  const property = await prisma.property.create({
    data: {
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      address: '123 Main Street',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      latitude: 30.2672,
      longitude: -97.7431,
    }
  });

  await prisma.listing.create({
    data: {
      propertyId: property.id,
      source: 'MLS',
      status: 'ACTIVE',
      mlsBoardId: 'CanopyMLS',
      slug: '123-main-street-austin-tx',
      mlsId: 'AUS001',
      imageUrl: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800',
      listPrice: 450000,
      listDate: new Date('2026-01-01T00:00:00.000Z'),
    },
  });

  return {
    user,
    adminUser,
    property
  };
};

export const expectValidationError = (response, field) => {
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Validation failed');
  expect(response.body.details).toBeDefined();
  if (field) {
    expect(response.body.details).toHaveProperty(field);
  }
};

export const expectAuthError = (response) => {
  expect(response.status).toBe(401);
  expect(response.body.error).toBeDefined();
};

export const expectForbiddenError = (response) => {
  expect(response.status).toBe(403);
  expect(response.body.error).toBe('Insufficient permissions');
};

export const expectNotFoundError = (response) => {
  expect(response.status).toBe(404);
  expect(response.body.error).toBeDefined();
};

export const expectServerError = (response) => {
  expect(response.status).toBe(500);
  expect(response.body.error).toBeDefined();
};

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
