/**
 * Google OAuth 2.0 for public web sign-in (authorization code flow).
 * Uses token + userinfo endpoints; no extra npm deps.
 */

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

type GoogleOAuthConfig = {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUri: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GoogleErrorResponse = {
  error?: string;
  error_description?: string;
};

export type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
};

export function getGoogleWebOAuthConfig(): GoogleOAuthConfig {
  const clientId =
    process.env.GOOGLE_WEB_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_WEB_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_WEB_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_WEB_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET;
  const apiBase = process.env.API_URL || `http://localhost:${process.env.API_PORT || 3001}`;
  const redirectUri =
    process.env.GOOGLE_WEB_REDIRECT_URI ||
    process.env.GOOGLE_OAUTH_WEB_REDIRECT_URI ||
    `${apiBase}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function buildGoogleAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
  clientId: string;
}): string {
  const u = new URL(GOOGLE_AUTH);
  u.searchParams.set('client_id', params.clientId);
  u.searchParams.set('redirect_uri', params.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', params.state);
  return u.toString();
}

export async function exchangeGoogleCode(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({})) as GoogleTokenResponse & GoogleErrorResponse;
  if (!res.ok) {
    const msg = data.error_description || data.error || `token_exchange_failed_${res.status}`;
    throw new Error(String(msg));
  }
  return data;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({})) as GoogleUserInfo & GoogleErrorResponse;
  if (!res.ok) {
    throw new Error(data.error || `userinfo_failed_${res.status}`);
  }
  return data;
}

export function isGoogleEmailVerified(userinfo: { email_verified?: boolean | string }): boolean {
  return userinfo.email_verified === true || userinfo.email_verified === 'true';
}

/**
 * Strictly resolves the OAuth callback base for a given auth purpose. Agent
 * sign-in must land back on agent-hq and portal sign-in must land back on the
 * web app — no cross-purpose fallback. Returns null if the caller-supplied
 * callback_base doesn't match the expected base for that purpose.
 */
export function resolveOAuthCallbackBase(
  authPurpose: 'agent' | 'portal',
  rawCallbackBase: string | undefined
): string | null {
  const expected = authPurpose === 'agent'
    ? (process.env.AGENT_HQ_URL || 'http://localhost:3002').replace(/\/$/, '')
    : (process.env.FRONTEND_URL || process.env.WEB_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const raw = (rawCallbackBase || '').replace(/\/$/, '');
  return raw === expected ? expected : null;
}
