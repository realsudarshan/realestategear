import { describe, it, expect } from 'vitest';
import { loadMlsConfig } from '../../../src/config/mls.js';
import { StaticBearerTokenAuth } from '../../../src/connectors/reso/auth/StaticBearerTokenAuth.js';
import { OAuth2ClientCredentialsAuth } from '../../../src/connectors/reso/auth/OAuth2ClientCredentialsAuth.js';

describe('loadMlsConfig', () => {
  it('returns null when MLS_AUTH_TYPE is unset (service boots idle)', () => {
    expect(loadMlsConfig({})).toBeNull();
  });

  it('throws for an unrecognized MLS_AUTH_TYPE', () => {
    expect(() => loadMlsConfig({ MLS_AUTH_TYPE: 'carrier-pigeon' })).toThrow('MLS_AUTH_TYPE must be');
  });

  it('throws when static auth is declared but MLS_ACCESS_TOKEN is missing', () => {
    expect(() =>
      loadMlsConfig({ MLS_AUTH_TYPE: 'static', MLS_BASE_URL: 'https://api.mlsgrid.com/v2', MLS_BOARD_ID: 'CanopyMLS' }),
    ).toThrow('MLS_ACCESS_TOKEN is required');
  });

  it('throws when MLS_BOARD_ID is missing — no default board', () => {
    expect(() =>
      loadMlsConfig({ MLS_AUTH_TYPE: 'static', MLS_BASE_URL: 'https://api.mlsgrid.com/v2', MLS_ACCESS_TOKEN: 'tok' }),
    ).toThrow('MLS_BOARD_ID is not set');
  });

  it('loads a full MLS-Grid-shaped static config', () => {
    const settings = loadMlsConfig({
      MLS_AUTH_TYPE: 'static',
      MLS_BASE_URL: 'https://api.mlsgrid.com/v2',
      MLS_ACCESS_TOKEN: 'tok',
      MLS_BOARD_ID: 'CanopyMLS',
      MLS_BOARD_SCOPE_FIELD: 'OriginatingSystemName',
      MLS_VIEWABLE_FLAG_FIELD: 'MlgCanView',
    });

    expect(settings).not.toBeNull();
    expect(settings!.connector.baseUrl).toBe('https://api.mlsgrid.com/v2');
    expect(settings!.connector.authStrategy).toBeInstanceOf(StaticBearerTokenAuth);
    expect(settings!.connector.boardScopeField).toBe('OriginatingSystemName');
    // Defaults to MLS_BOARD_ID when a scope field is set but no explicit value is given.
    expect(settings!.connector.boardScopeValue).toBe('CanopyMLS');
    expect(settings!.connector.viewableFlagField).toBe('MlgCanView');
    expect(settings!.sync).toEqual({
      providerId: 'mls',
      mlsBoardId: 'CanopyMLS',
      prefix: undefined,
      accessToken: 'tok',
      publicDisplayEnabled: false,
      viewableFlagField: 'MlgCanView',
    });
  });

  it('lets MLS_BOARD_SCOPE_VALUE override the default when it differs from MLS_BOARD_ID', () => {
    const settings = loadMlsConfig({
      MLS_AUTH_TYPE: 'static',
      MLS_BASE_URL: 'https://api.mlsgrid.com/v2',
      MLS_ACCESS_TOKEN: 'tok',
      MLS_BOARD_ID: 'canopy',
      MLS_BOARD_SCOPE_FIELD: 'OriginatingSystemName',
      MLS_BOARD_SCOPE_VALUE: 'CanopyMLS',
    });
    expect(settings!.sync.mlsBoardId).toBe('canopy');
    expect(settings!.connector.boardScopeValue).toBe('CanopyMLS');
  });

  it('omits board-scope entirely when no field is configured (a single-board Trestle-shaped credential)', () => {
    const settings = loadMlsConfig({
      MLS_AUTH_TYPE: 'oauth2_client_credentials',
      MLS_BASE_URL: 'https://api.trestle.example/trestle/odata',
      MLS_OAUTH_TOKEN_URL: 'https://api.trestle.example/oidc/connect/token',
      MLS_OAUTH_CLIENT_ID: 'client-1',
      MLS_OAUTH_CLIENT_SECRET: 'secret-1',
      MLS_BOARD_ID: 'trestle-board-1',
    });
    expect(settings!.connector.boardScopeField).toBeUndefined();
    expect(settings!.connector.boardScopeValue).toBeUndefined();
    expect(settings!.connector.authStrategy).toBeInstanceOf(OAuth2ClientCredentialsAuth);
    // OAuth2 vendors have no single long-lived token to reuse for media downloads.
    expect(settings!.sync.accessToken).toBeUndefined();
  });

  it('throws when oauth2 auth is declared but required fields are missing', () => {
    expect(() =>
      loadMlsConfig({
        MLS_AUTH_TYPE: 'oauth2_client_credentials',
        MLS_BASE_URL: 'https://api.trestle.example/trestle/odata',
        MLS_BOARD_ID: 'trestle-board-1',
        MLS_OAUTH_CLIENT_ID: 'client-1',
        // MLS_OAUTH_CLIENT_SECRET and MLS_OAUTH_TOKEN_URL missing
      }),
    ).toThrow('MLS_OAUTH_TOKEN_URL, MLS_OAUTH_CLIENT_ID, and MLS_OAUTH_CLIENT_SECRET');
  });

  it('public display is OFF unless explicitly enabled (compliance default)', () => {
    const base = { MLS_AUTH_TYPE: 'static', MLS_BASE_URL: 'https://api.mlsgrid.com/v2', MLS_ACCESS_TOKEN: 'tok', MLS_BOARD_ID: 'CanopyMLS' };
    expect(loadMlsConfig(base)!.sync.publicDisplayEnabled).toBe(false);
    expect(loadMlsConfig({ ...base, MLS_PUBLIC_DISPLAY_ENABLED: 'true' })!.sync.publicDisplayEnabled).toBe(true);
  });

  it('honors connector tuning overrides', () => {
    const settings = loadMlsConfig({
      MLS_AUTH_TYPE: 'static',
      MLS_BASE_URL: 'https://example.test/v2',
      MLS_ACCESS_TOKEN: 'tok',
      MLS_BOARD_ID: 'TriangleMLS',
      MLS_PREFIX: 'TRI',
      MLS_PAGE_SIZE: '1000',
      MLS_PROVIDER_ID: 'mlsgrid-tri',
    });
    expect(settings!.connector.baseUrl).toBe('https://example.test/v2');
    expect(settings!.connector.prefix).toBe('TRI');
    expect(settings!.connector.pageSize).toBe(1000);
    expect(settings!.sync.providerId).toBe('mlsgrid-tri');
    expect(settings!.sync.prefix).toBe('TRI');
  });
});
