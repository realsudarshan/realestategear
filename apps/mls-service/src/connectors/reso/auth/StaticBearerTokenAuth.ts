import type { AuthStrategy } from './types.js';

/** Static, non-expiring bearer token — MLS Grid's auth model. */
export class StaticBearerTokenAuth implements AuthStrategy {
  constructor(private readonly token: string) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${this.token}` };
  }
}
