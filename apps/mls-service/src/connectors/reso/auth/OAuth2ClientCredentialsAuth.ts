import axios from 'axios';
import type { AuthStrategy } from './types.js';

/** Trestle/Bridge/Spark's auth model — client credentials exchanged for a
 *  bearer token that expires and must be refreshed (e.g. 8h for Trestle). */
export interface OAuth2ClientCredentialsConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  /** Refresh this many seconds before actual expiry. Default 60s. */
  expiryBufferSec?: number;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

/** Injectable so tests never hit a real token endpoint. */
export interface TokenFetcher {
  fetchToken(config: OAuth2ClientCredentialsConfig): Promise<TokenResponse>;
}

const defaultTokenFetcher: TokenFetcher = {
  async fetchToken(config) {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    if (config.scope) body.set('scope', config.scope);
    const resp = await axios.post<TokenResponse>(config.tokenUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return resp.data;
  },
};

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

export class OAuth2ClientCredentialsAuth implements AuthStrategy {
  private cached?: CachedToken;
  private inflight?: Promise<CachedToken>;
  private readonly tokenFetcher: TokenFetcher;
  private readonly now: () => number;

  constructor(
    private readonly config: OAuth2ClientCredentialsConfig,
    deps: { tokenFetcher?: TokenFetcher; now?: () => number } = {},
  ) {
    this.tokenFetcher = deps.tokenFetcher ?? defaultTokenFetcher;
    this.now = deps.now ?? Date.now;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const now = this.now();
    if (!this.cached || this.cached.expiresAt <= now) {
      // Single-flight: runSync.ts dispatches CONCURRENCY-way concurrent work
      // per page, so without this an expiring token would fire that many
      // simultaneous token-endpoint calls on the first request after expiry.
      this.inflight ??= this.refresh().finally(() => {
        this.inflight = undefined;
      });
      this.cached = await this.inflight;
    }
    return { Authorization: `Bearer ${this.cached.accessToken}` };
  }

  private async refresh(): Promise<CachedToken> {
    const token = await this.tokenFetcher.fetchToken(this.config);
    const bufferMs = (this.config.expiryBufferSec ?? 60) * 1000;
    const ttlMs = (token.expires_in ?? 3600) * 1000;
    return { accessToken: token.access_token, expiresAt: this.now() + ttlMs - bufferMs };
  }
}
