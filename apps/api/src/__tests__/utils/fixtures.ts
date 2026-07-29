// Test fixtures for API testing
// Note: id/createdAt/updatedAt are omitted — Prisma generates them automatically.
export const mockUser = {
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'USER',
  phoneNumber: '+1234567890',
};

export const mockAdminUser = {
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN',
  phoneNumber: '+1234567891',
};

export const mockProperty = {
  bedrooms: 3,
  bathrooms: 2,
  squareFeet: 1800,
  address: '123 Main Street',
  city: 'Austin',
  state: 'TX',
  zipCode: '78701',
  latitude: 30.2672,
  longitude: -97.7431,
};

export const mockProperties = [
  mockProperty,
  {
    bedrooms: 2,
    bathrooms: 2,
    squareFeet: 1200,
    address: '456 Congress Ave',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    latitude: 30.2672,
    longitude: -97.7431,
    propertyType: 'CONDO',
  },
  {
    bedrooms: 2,
    bathrooms: 1,
    squareFeet: 1000,
    address: '789 Oak Street',
    city: 'Austin',
    state: 'TX',
    zipCode: '78702',
    latitude: 30.2672,
    longitude: -97.7431,
    }
];

export const mockJWTPayload = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'USER',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
};

export const mockAdminJWTPayload = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'ADMIN',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
};

export const mockValidRegistrationData = {
  email: 'newuser@example.com',
  password: 'password123',
  firstName: 'New',
  lastName: 'User',
  phoneNumber: '+1234567892'
};

export const mockValidLoginData = {
  email: 'test@example.com',
  password: 'password123'
};

export const mockSearchQuery = {
  minPrice: 200000,
  maxPrice: 400000,
  bedrooms: 2,
  bathrooms: 1,
  location: 'Austin'
};

export const mockPropertyFilters = {
  minPrice: 100000,
  maxPrice: 500000,
  bedrooms: 3,
  bathrooms: 2,
  city: 'Austin',
  state: 'TX'
};
