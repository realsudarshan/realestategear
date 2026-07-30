import { describe, expect, it } from 'vitest';
import {
  andTypesenseFilters,
  buildPublicListingWhere,
  buildPublicPropertyTypesenseFilter,
  getPublicPropertyTypesenseBaselineFilter,
  isMlsPublicDisplayEnabled,
} from './propertyVisibility.js';

describe('property visibility', () => {
  it('enables MLS display only for the exact string true', () => {
    expect(isMlsPublicDisplayEnabled({ MLS_PUBLIC_DISPLAY_ENABLED: 'true' })).toBe(true);
    expect(isMlsPublicDisplayEnabled({ MLS_PUBLIC_DISPLAY_ENABLED: 'TRUE' })).toBe(false);
    expect(isMlsPublicDisplayEnabled({ MLS_PUBLIC_DISPLAY_ENABLED: '1' })).toBe(false);
    expect(isMlsPublicDisplayEnabled({})).toBe(false);
  });

  it('builds a fail-closed public listing predicate', () => {
    expect(buildPublicListingWhere(undefined, {})).toEqual({
      status: 'ACTIVE',
      idxDisplayable: true,
      source: { not: 'MLS' },
    });
    expect(buildPublicListingWhere(undefined, { MLS_PUBLIC_DISPLAY_ENABLED: 'true' })).toEqual({
      status: 'ACTIVE',
      idxDisplayable: true,
    });
  });

  it('ANDs caller predicates so they cannot replace visibility requirements', () => {
    expect(buildPublicListingWhere({ status: 'SOLD', mlsBoardId: 'board-1' }, {})).toEqual({
      AND: [
        { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } },
        { status: 'SOLD', mlsBoardId: 'board-1' },
      ],
    });
  });

  it('builds and combines the Typesense visibility baseline', () => {
    expect(getPublicPropertyTypesenseBaselineFilter({})).toBe(
      'status:=Active && idxDisplayable:=true && source:!=MLS',
    );
    expect(getPublicPropertyTypesenseBaselineFilter({ MLS_PUBLIC_DISPLAY_ENABLED: 'true' })).toBe(
      'status:=Active && idxDisplayable:=true',
    );
    expect(andTypesenseFilters('status:=Active', 'price:>=500000')).toBe(
      '(status:=Active) && (price:>=500000)',
    );
    expect(buildPublicPropertyTypesenseFilter('city:=Charlotte', {})).toBe(
      '(status:=Active && idxDisplayable:=true && source:!=MLS) && (city:=Charlotte)',
    );
    expect(buildPublicPropertyTypesenseFilter('   ', { MLS_PUBLIC_DISPLAY_ENABLED: 'true' })).toBe(
      'status:=Active && idxDisplayable:=true',
    );
  });
});
