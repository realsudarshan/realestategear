import { describe, it, expect } from 'vitest';
import { ResoWebApiConnector } from '../../../../src/connectors/reso/ResoWebApiConnector.js';
import { StaticBearerTokenAuth } from '../../../../src/connectors/reso/auth/StaticBearerTokenAuth.js';
import type { AuthStrategy } from '../../../../src/connectors/reso/auth/types.js';
import type { HttpClient, ResoConnectorConfig } from '../../../../src/connectors/reso/types.js';

const baseConfig: ResoConnectorConfig = {
  baseUrl: 'https://api.mlsgrid.com/v2',
  authStrategy: new StaticBearerTokenAuth('tok'),
  boardScopeField: 'OriginatingSystemName',
  boardScopeValue: 'CanopyMLS',
  viewableFlagField: 'MlgCanView',
  pageSize: 5000,
  retryBaseDelayMs: 1, // keep retry backoff near-instant in tests
};

interface PageResponse {
  data: unknown;
  status: number;
}

/** A fake HttpClient that records requested URLs (and headers) and returns programmed responses. */
function fakeHttp(handler: (url: string, callNumber: number) => PageResponse) {
  const calls: string[] = [];
  const headerCalls: (Record<string, string> | undefined)[] = [];
  const client: HttpClient = {
    get: async <T,>(url: string, headers?: Record<string, string>): Promise<{ data: T; status: number }> => {
      calls.push(url);
      headerCalls.push(headers);
      const response = handler(url, calls.length);
      return { data: response.data as T, status: response.status };
    },
  };
  return { calls, headerCalls, client };
}

function httpError(status: number): Error {
  const err = new Error(`http ${status}`) as Error & { response: { status: number } };
  err.response = { status };
  return err;
}

async function collect<T>(gen: AsyncGenerator<T[]>): Promise<T[][]> {
  const pages: T[][] = [];
  for await (const page of gen) pages.push(page);
  return pages;
}

const stub = fakeHttp(() => ({ data: {}, status: 200 }));

describe('buildFilter — board scoping + removal-aware incremental (D5)', () => {
  const c = new ResoWebApiConnector(baseConfig, { httpClient: stub.client });

  it('scopes to the board when boardScopeField/Value are configured', () => {
    expect(c.buildFilter('Property')).toBe("OriginatingSystemName eq 'CanopyMLS'");
  });

  it('incremental adds the watermark and does NOT inject the viewable flag', () => {
    const f = c.buildFilter('Property', { since: new Date('2026-06-01T00:00:00.000Z') });
    expect(f).toContain("OriginatingSystemName eq 'CanopyMLS'");
    expect(f).toContain('ModificationTimestamp gt 2026-06-01T00:00:00.000Z');
    expect(f).not.toContain('MlgCanView');
  });

  it('full import may require viewable with no watermark', () => {
    const f = c.buildFilter('Property', { requireViewable: true });
    expect(f).toContain('MlgCanView eq true');
    expect(f).not.toContain('ModificationTimestamp');
  });

  it('omits the board clause entirely when no boardScopeField/Value is configured (Trestle shape)', () => {
    const trestle = new ResoWebApiConnector(
      { ...baseConfig, boardScopeField: undefined, boardScopeValue: undefined },
      { httpClient: stub.client },
    );
    expect(trestle.buildFilter('Property')).toBe('');
  });

  it('does not add the viewable clause when viewableFlagField is unset, even with requireViewable', () => {
    const noFlag = new ResoWebApiConnector({ ...baseConfig, viewableFlagField: undefined }, { httpClient: stub.client });
    expect(() => noFlag.buildFilter('Property', { requireViewable: true })).not.toThrow();
    expect(noFlag.buildFilter('Property', { requireViewable: true })).not.toContain('eq true');
  });
});

describe('buildPath — query construction', () => {
  const c = new ResoWebApiConnector(baseConfig, { httpClient: stub.client });

  it('includes $top, $orderby and a url-encoded $filter', () => {
    const p = c.buildPath('Property', { since: new Date('2026-06-01T00:00:00.000Z') });
    expect(p.startsWith('/Property?')).toBe(true);
    expect(p).toContain('$top=5000');
    expect(p).toContain('$orderby=ModificationTimestamp');
    expect(p).toContain('%20'); // spaces in the filter are encoded
  });

  it('adds $expand=Media only when requested (D7)', () => {
    expect(c.buildPath('Property', { expandMedia: true })).toContain('$expand=Media');
    expect(c.buildPath('Property')).not.toContain('$expand');
  });

  it('honors an explicit large page size instead of clamping to MLS Grid\'s 5000 limit', () => {
    const big = new ResoWebApiConnector({ ...baseConfig, pageSize: 999999 }, { httpClient: stub.client });
    expect(big.buildPath('Property')).toContain('$top=999999');
  });

  it('omits $filter= entirely when the composed filter is empty (Trestle shape, full sync, no watermark)', () => {
    const trestle = new ResoWebApiConnector(
      { ...baseConfig, boardScopeField: undefined, boardScopeValue: undefined, viewableFlagField: undefined },
      { httpClient: stub.client },
    );
    const path = trestle.buildPath('Property');
    expect(path).not.toContain('$filter=');
    expect(path).toContain('$top=');
  });
});

describe('fetchResource — @odata.nextLink pagination (D3) / streaming (D15)', () => {
  it('follows nextLink until absent, yielding one page at a time', async () => {
    const nextUrl = 'https://api.mlsgrid.com/v2/Property?$skiptoken=abc';
    const http = fakeHttp((_url, n) =>
      n === 1
        ? { data: { value: [{ ListingKey: 'A' }], '@odata.nextLink': nextUrl }, status: 200 }
        : { data: { value: [{ ListingKey: 'B' }] }, status: 200 },
    );
    const c = new ResoWebApiConnector(baseConfig, { httpClient: http.client });

    const pages = await collect(c.fetchResource('Property'));

    expect(pages).toEqual([[{ ListingKey: 'A' }], [{ ListingKey: 'B' }]]);
    expect(http.calls[0]).toContain('/Property?');
    expect(http.calls[1]).toBe(nextUrl); // followed the absolute nextLink verbatim
  });

  it('stops after a single page with no nextLink', async () => {
    const http = fakeHttp(() => ({ data: { value: [] }, status: 200 }));
    const c = new ResoWebApiConnector(baseConfig, { httpClient: http.client });

    const pages = await collect(c.fetchResource('Member'));

    expect(pages).toEqual([[]]);
    expect(http.calls).toHaveLength(1);
  });

  it('computes auth headers fresh on every request (not baked in at construction)', async () => {
    let call = 0;
    const authStrategy: AuthStrategy = {
      getAuthHeaders: async () => {
        call += 1;
        return { Authorization: `Bearer token-${call}` };
      },
    };
    const http = fakeHttp((_url, n) =>
      n === 1
        ? { data: { value: [], '@odata.nextLink': 'https://api.mlsgrid.com/v2/Property?$skiptoken=x' }, status: 200 }
        : { data: { value: [] }, status: 200 },
    );
    const c = new ResoWebApiConnector({ ...baseConfig, authStrategy }, { httpClient: http.client });

    await collect(c.fetchResource('Property'));

    expect(http.headerCalls[0]).toEqual({ Authorization: 'Bearer token-1' });
    expect(http.headerCalls[1]).toEqual({ Authorization: 'Bearer token-2' });
  });
});

describe('executeWithRetry — backoff on transient errors (D2)', () => {
  it('retries a 5xx then succeeds', async () => {
    let n = 0;
    const client: HttpClient = {
      get: async <T,>(_url: string): Promise<{ data: T; status: number }> => {
        n += 1;
        if (n === 1) throw httpError(503);
        return { data: { value: [] } as T, status: 200 };
      },
    };
    const c = new ResoWebApiConnector(baseConfig, { httpClient: client });

    const pages = await collect(c.fetchResource('Office'));

    expect(pages).toEqual([[]]);
    expect(n).toBe(2); // one retry
  });

  it('does NOT retry a 4xx — it propagates immediately', async () => {
    let n = 0;
    const client: HttpClient = {
      get: async <T,>(_url: string): Promise<{ data: T; status: number }> => {
        n += 1;
        throw httpError(404);
      },
    };
    const c = new ResoWebApiConnector(baseConfig, { httpClient: client });

    await expect(collect(c.fetchResource('Property'))).rejects.toThrow('http 404');
    expect(n).toBe(1);
  });
});
