import { describe, it, expect } from 'vitest';
import { StaticBearerTokenAuth } from '../../../../../src/connectors/reso/auth/StaticBearerTokenAuth.js';

describe('StaticBearerTokenAuth', () => {
  it('always returns the same bearer header, no network call', async () => {
    const auth = new StaticBearerTokenAuth('tok-123');
    expect(await auth.getAuthHeaders()).toEqual({ Authorization: 'Bearer tok-123' });
    expect(await auth.getAuthHeaders()).toEqual({ Authorization: 'Bearer tok-123' });
  });
});
