import { getPortalConfig, toPublicPortalConfig, type ResolveOptions } from '@realestategear/portal-config';

function resolveEnvironment(): ResolveOptions['environment'] {
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.RAILWAY_ENVIRONMENT_NAME === 'preview' || process.env.VERCEL_ENV === 'preview') return 'preview';
  if (process.env.RAILWAY_ENVIRONMENT_NAME === 'staging') return 'staging';
  return 'local';
}

export function getPublicPortalConfig() {
  const config = getPortalConfig({ environment: resolveEnvironment() });
  return toPublicPortalConfig(config);
}

export function getPublicPortalListingPolicy() {
  return getPublicPortalConfig().listings;
}
