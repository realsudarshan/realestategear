// @realestategear/api-client — typed consumer client for apps/api (factory, not singleton).
// Endpoint-specific exports will live here as the API contract matures.

export type ApiUrlEnv = Record<string, string | undefined>;

const DEFAULT_API_BASE_URL = "http://localhost:3001";

export function resolveServerApiBaseUrl(
  env: ApiUrlEnv,
  fallback = DEFAULT_API_BASE_URL
): string {
  return normalizeApiBaseUrl(
    ownValue(env, "API_INTERNAL_URL") ??
      ownValue(env, "API_URL") ??
      ownValue(env, "NEXT_PUBLIC_API_URL") ??
      fallback
  );
}

export function resolvePublicApiBaseUrl(
  env: ApiUrlEnv,
  fallback = DEFAULT_API_BASE_URL
): string {
  return normalizeApiBaseUrl(ownValue(env, "NEXT_PUBLIC_API_URL") ?? fallback);
}

function normalizeApiBaseUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TypeError("API base URL must be an absolute URL.");
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new TypeError("API base URL must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new TypeError("API base URL must not contain credentials.");
  }
  if (parsed.search || parsed.hash) {
    throw new TypeError("API base URL must not contain a query or fragment.");
  }

  return parsed.toString().replace(/\/$/, "");
}

function ownValue(env: ApiUrlEnv, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
}
