import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const generateScopedSearchKey = vi.hoisted(() => vi.fn(() => 'scoped-key'));
vi.mock('typesense', () => ({
  default: { Client: class { keys() { return { generateScopedSearchKey }; } } },
}));
vi.mock('db', () => ({
  ListingStatus: { ACTIVE: 'ACTIVE' },
  ListingSource: { MLS: 'MLS' },
}));

const originalDisplay = process.env.MLS_PUBLIC_DISPLAY_ENABLED;
const originalKey = process.env.TYPESENSE_API_KEY;
const { generateAgentSearchKey, generateWebSearchKey } = await import('../../../search/keys.js');

describe('Typesense scoped keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00Z'));
    process.env.TYPESENSE_API_KEY = 'admin-key';
    delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
  });

  afterAll(() => {
    vi.useRealTimers();
    if (originalDisplay === undefined) delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
    else process.env.MLS_PUBLIC_DISPLAY_ENABLED = originalDisplay;
    if (originalKey === undefined) delete process.env.TYPESENSE_API_KEY;
    else process.env.TYPESENSE_API_KEY = originalKey;
  });

  it('limits web keys to the fail-closed public baseline for one hour', () => {
    generateWebSearchKey();
    expect(generateScopedSearchKey).toHaveBeenCalledWith('admin-key', {
      collection: 'properties',
      filter_by: 'status:=Active && idxDisplayable:=true && source:!=MLS',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
  });

  it('keeps account scoping for agent data and applies the public property baseline', () => {
    generateAgentSearchKey('account-1');
    expect(generateScopedSearchKey).toHaveBeenCalledWith('admin-key', {
      filter_by: '(accountId:=account-1) || (status:=Active && idxDisplayable:=true && source:!=MLS)',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
  });
});
