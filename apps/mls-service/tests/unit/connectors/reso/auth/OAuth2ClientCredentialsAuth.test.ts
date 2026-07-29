import { describe, it, expect, vi } from 'vitest';
import { OAuth2ClientCredentialsAuth, type TokenFetcher } from '../../../../../src/connectors/reso/auth/OAuth2ClientCredentialsAuth.js';

const baseConfig = {
  tokenUrl: 'https://vendor.example/oauth/token',
  clientId: 'client-1',
  clientSecret: 'secret-1',
};

describe('OAuth2ClientCredentialsAuth', () => {
  it('fetches once and caches within the expiry window', async () => {
    const fetchToken = vi.fn(async () => ({ access_token: 'tok-1', expires_in: 3600 }));
    const tokenFetcher: TokenFetcher = { fetchToken };
    let now = 0;
    const auth = new OAuth2ClientCredentialsAuth(baseConfig, { tokenFetcher, now: () => now });

    expect(await auth.getAuthHeaders()).toEqual({ Authorization: 'Bearer tok-1' });
    now += 1000; // well within the 1h expiry
    expect(await auth.getAuthHeaders()).toEqual({ Authorization: 'Bearer tok-1' });
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('refetches after expiry (minus the buffer)', async () => {
    let n = 0;
    const fetchToken = vi.fn(async () => {
      n += 1;
      return { access_token: `tok-${n}`, expires_in: 3600 };
    });
    let now = 0;
    const auth = new OAuth2ClientCredentialsAuth(
      { ...baseConfig, expiryBufferSec: 60 },
      { tokenFetcher: { fetchToken }, now: () => now },
    );

    expect(await auth.getAuthHeaders()).toEqual({ Authorization: 'Bearer tok-1' });
    now += (3600 - 60 + 1) * 1000; // past expiry minus buffer
    expect(await auth.getAuthHeaders()).toEqual({ Authorization: 'Bearer tok-2' });
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('does not refetch before the buffered expiry', async () => {
    const fetchToken = vi.fn(async () => ({ access_token: 'tok-1', expires_in: 3600 }));
    let now = 0;
    const auth = new OAuth2ClientCredentialsAuth(
      { ...baseConfig, expiryBufferSec: 60 },
      { tokenFetcher: { fetchToken }, now: () => now },
    );

    await auth.getAuthHeaders();
    now += (3600 - 120) * 1000; // still before the buffered cutoff
    await auth.getAuthHeaders();
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('single-flights concurrent calls into exactly one token-endpoint request', async () => {
    let resolveToken: (value: { access_token: string; expires_in: number }) => void;
    const pending = new Promise<{ access_token: string; expires_in: number }>((resolve) => {
      resolveToken = resolve;
    });
    const fetchToken = vi.fn(() => pending);
    const auth = new OAuth2ClientCredentialsAuth(baseConfig, { tokenFetcher: { fetchToken }, now: () => 0 });

    const calls = [auth.getAuthHeaders(), auth.getAuthHeaders(), auth.getAuthHeaders()];
    resolveToken!({ access_token: 'tok-1', expires_in: 3600 });
    const results = await Promise.all(calls);

    expect(fetchToken).toHaveBeenCalledTimes(1);
    for (const r of results) expect(r).toEqual({ Authorization: 'Bearer tok-1' });
  });

  it('propagates a token-endpoint error rather than returning stale/empty headers', async () => {
    const fetchToken = vi.fn(async () => {
      throw new Error('token endpoint unreachable');
    });
    const auth = new OAuth2ClientCredentialsAuth(baseConfig, { tokenFetcher: { fetchToken }, now: () => 0 });

    await expect(auth.getAuthHeaders()).rejects.toThrow('token endpoint unreachable');
  });
});
