import { describe, it, expect } from 'vitest';
import {
  normalizeStatus,
  normalizePropertyType,
  normalizeSubdivision,
  assembleAddress,
  toRawData,
  isIdxDisplayable,
} from '../../../src/sync/mappers.js';

describe('normalizeStatus (D10) — fail-safe RESO → ListingStatus', () => {
  const known: Array<[string, string]> = [
    ['Active', 'ACTIVE'],
    ['Active Under Contract', 'PENDING'],
    ['Pending', 'PENDING'],
    ['Closed', 'SOLD'],
    ['Coming Soon', 'COMING_SOON'],
    ['Canceled', 'WITHDRAWN'],
    ['Withdrawn', 'WITHDRAWN'],
    ['Expired', 'EXPIRED'],
    ['Hold', 'WITHDRAWN'],
  ];

  it.each(known)('maps %s → %s (recognized)', (raw, expected) => {
    const r = normalizeStatus(raw);
    expect(r.status).toBe(expected);
    expect(r.recognized).toBe(true);
  });

  // The trust-critical invariant: an unrecognized status must NEVER become ACTIVE.
  it.each([
    'Some New RESO Status',
    'active', // case-sensitive RESO values; lowercase is not a match
    '',
    '   ',
    undefined,
    null,
    42,
  ])('unrecognized input %p is flagged and is NEVER ACTIVE', (raw) => {
    const r = normalizeStatus(raw as unknown);
    expect(r.recognized).toBe(false);
    expect(r.status).not.toBe('ACTIVE');
  });
});

describe('normalizePropertyType (D10)', () => {
  it('maps known RESO sub-types', () => {
    expect(normalizePropertyType('Single Family Residence')).toBe('SINGLE_FAMILY');
    expect(normalizePropertyType('Condominium')).toBe('CONDO');
    expect(normalizePropertyType('Townhouse')).toBe('TOWNHOUSE');
    expect(normalizePropertyType('Duplex')).toBe('MULTI_FAMILY');
    expect(normalizePropertyType('Land')).toBe('LAND');
  });

  it('returns undefined for unknown / empty (never guesses)', () => {
    expect(normalizePropertyType('Houseboat')).toBeUndefined();
    expect(normalizePropertyType('')).toBeUndefined();
    expect(normalizePropertyType(undefined)).toBeUndefined();
  });
});

describe('normalizeSubdivision (TODO-2) — collapse dirty variants', () => {
  it('collapses case + whitespace + trailing "Sub(division)" to one value', () => {
    const variants = ['Birkdale', 'BIRKDALE', '  birkdale  ', 'Birkdale Subdivision', 'Birkdale Sub'];
    const normalized = variants.map((v) => normalizeSubdivision(v));
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe('Birkdale');
  });

  it('preserves multi-word names, title-cased', () => {
    expect(normalizeSubdivision('lake norman   shores')).toBe('Lake Norman Shores');
  });

  it('returns undefined for empty / nullish', () => {
    expect(normalizeSubdivision('')).toBeUndefined();
    expect(normalizeSubdivision('   ')).toBeUndefined();
    expect(normalizeSubdivision(undefined)).toBeUndefined();
  });
});

describe('assembleAddress (Codex #10)', () => {
  it('prefers UnparsedAddress, collapsing whitespace (real RESO field)', () => {
    expect(assembleAddress({ UnparsedAddress: '1506  Timber St  ', StreetName: 'ignored' })).toBe(
      '1506 Timber St',
    );
  });

  it('assembles from components when UnparsedAddress is absent', () => {
    expect(
      assembleAddress({
        StreetNumber: '123',
        StreetDirPrefix: 'N',
        StreetName: 'Main',
        StreetSuffix: 'St',
        UnitNumber: '4B',
      }),
    ).toBe('123 N Main St #4B');
  });

  it('skips missing components without leaving gaps', () => {
    expect(assembleAddress({ StreetNumber: '500', StreetName: 'Oak' })).toBe('500 Oak');
  });

  it('handles an empty record', () => {
    expect(assembleAddress({})).toBe('');
  });
});

describe('toRawData', () => {
  it('keeps all fields (incl. board-prefixed local ones) but strips heavy Media expansion', () => {
    const record = {
      ListingKey: 'ACT1',
      ACT_EstimatedTaxes: '4934.00', // board-local field — must be retained
      City: 'Georgetown',
      Media: [{ MediaURL: 'https://x' }], // owned by the Media table — stripped
    };
    const raw = toRawData(record);
    expect(raw).toEqual({ ListingKey: 'ACT1', ACT_EstimatedTaxes: '4934.00', City: 'Georgetown' });
    expect(raw.Media).toBeUndefined();
  });
});

describe('isIdxDisplayable (D19)', () => {
  it('blocks only on an explicit opt-out', () => {
    expect(isIdxDisplayable({ InternetEntireListingDisplayYN: false })).toBe(false);
  });

  it('allows display when the flag is true or absent', () => {
    expect(isIdxDisplayable({ InternetEntireListingDisplayYN: true })).toBe(true);
    expect(isIdxDisplayable({})).toBe(true);
  });
});
