import type { ResoConnectorConfig } from '../connectors/reso/types.js';
import type { SyncConfig } from '../sync/runSync.js';
import { StaticBearerTokenAuth } from '../connectors/reso/auth/StaticBearerTokenAuth.js';
import { OAuth2ClientCredentialsAuth } from '../connectors/reso/auth/OAuth2ClientCredentialsAuth.js';
import { num } from '../sync/coerce.js';

export interface MlsSettings {
  connector: ResoConnectorConfig;
  sync: SyncConfig;
}

type AuthType = 'static' | 'oauth2_client_credentials';

function isAuthType(value: string): value is AuthType {
  return value === 'static' || value === 'oauth2_client_credentials';
}

function buildStaticAuth(env: NodeJS.ProcessEnv): StaticBearerTokenAuth {
  const token = env.MLS_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('MLS_ACCESS_TOKEN is required when MLS_AUTH_TYPE=static.');
  return new StaticBearerTokenAuth(token);
}

function buildOAuth2Auth(env: NodeJS.ProcessEnv): OAuth2ClientCredentialsAuth {
  const tokenUrl = env.MLS_OAUTH_TOKEN_URL?.trim();
  const clientId = env.MLS_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.MLS_OAUTH_CLIENT_SECRET?.trim();
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error(
      'MLS_OAUTH_TOKEN_URL, MLS_OAUTH_CLIENT_ID, and MLS_OAUTH_CLIENT_SECRET are all required ' +
        'when MLS_AUTH_TYPE=oauth2_client_credentials.',
    );
  }
  return new OAuth2ClientCredentialsAuth({
    tokenUrl,
    clientId,
    clientSecret,
    scope: env.MLS_OAUTH_SCOPE?.trim() || undefined,
  });
}

/**
 * Typed RESO Web API configuration from the environment (decision D9 — no
 * JSON config file). Returns null when MLS_AUTH_TYPE is unset so the service
 * can boot idle in environments with no MLS configured at all (e.g. local
 * dev). Once MLS_AUTH_TYPE IS set, every other required field for that auth
 * type — and MLS_BOARD_ID — must be present too: there is no default vendor
 * and no default board. See docs/MLS_BOARD_SETUP.md for the full self-hoster
 * walkthrough.
 */
export function loadMlsConfig(env: NodeJS.ProcessEnv = process.env): MlsSettings | null {
  const authTypeRaw = env.MLS_AUTH_TYPE?.trim();
  if (!authTypeRaw) return null;
  if (!isAuthType(authTypeRaw)) {
    throw new Error(`MLS_AUTH_TYPE must be "static" or "oauth2_client_credentials", got "${authTypeRaw}".`);
  }

  const baseUrl = env.MLS_BASE_URL?.trim();
  if (!baseUrl) throw new Error('MLS_BASE_URL is required once MLS_AUTH_TYPE is set.');

  const mlsBoardId = env.MLS_BOARD_ID?.trim();
  if (!mlsBoardId) {
    throw new Error(
      'MLS_BOARD_ID is not set. Every deployment must declare which MLS board this is syncing ' +
        '— there is no default board. Set MLS_BOARD_ID and redeploy.',
    );
  }

  const authStrategy = authTypeRaw === 'static' ? buildStaticAuth(env) : buildOAuth2Auth(env);

  const boardScopeField = env.MLS_BOARD_SCOPE_FIELD?.trim() || undefined;
  // Defaults to MLS_BOARD_ID when a scope field is configured but no explicit
  // value is given — covers the common case (MLS Grid, where the API filter
  // value and the compliance/DB board identity coincide) while still
  // allowing override for the rare case they differ.
  const boardScopeValue = boardScopeField ? env.MLS_BOARD_SCOPE_VALUE?.trim() || mlsBoardId : undefined;
  const viewableFlagField = env.MLS_VIEWABLE_FLAG_FIELD?.trim() || undefined;
  const prefix = env.MLS_PREFIX?.trim() || undefined;
  const providerId = env.MLS_PROVIDER_ID?.trim() || 'mls';
  const publicDisplayEnabled = env.MLS_PUBLIC_DISPLAY_ENABLED === 'true';
  // Only meaningful for static (non-expiring) tokens — reused as the media-
  // download auth header (MLS Grid's no-hotlink rule). OAuth2 vendors have no
  // single long-lived token to reuse this way; media sync is skipped for them
  // until that seam gets its own auth abstraction (not built speculatively).
  const accessToken = authTypeRaw === 'static' ? env.MLS_ACCESS_TOKEN?.trim() : undefined;

  return {
    connector: {
      baseUrl,
      authStrategy,
      boardScopeField,
      boardScopeValue,
      viewableFlagField,
      prefix,
      pageSize: num(env.MLS_PAGE_SIZE),
      timeoutMs: num(env.MLS_TIMEOUT_MS),
      minRequestIntervalMs: num(env.MLS_MIN_REQUEST_INTERVAL_MS) ?? 500,
      maxRetries: num(env.MLS_MAX_RETRIES),
      retryBaseDelayMs: num(env.MLS_RETRY_BASE_DELAY_MS),
    },
    sync: { providerId, mlsBoardId, prefix, accessToken, publicDisplayEnabled, viewableFlagField },
  };
}
