import { describe, expect, it } from 'vitest';
import { buildTypesenseGeoFilter, normalizeArray, sanitizeFilterValue } from '../../../search/typesenseGeoFilter.js';
describe('Typesense geographic candidate filter', () => {
  it('groups geographic alternatives before the active candidate hint', () => expect(buildTypesenseGeoFilter({ cities: ['Charlotte'], zipCodes: ['28202'] })).toBe('(zipCode:=[28202] || city:=[Charlotte]) && status:=Active'));
  it('can omit status because public eligibility is enforced in Postgres', () => expect(buildTypesenseGeoFilter({ cities: ['Charlotte'] }, { appendStatus: false })).toBe('city:=[Charlotte]'));
  it('sanitizes operators and caps/deduplicates input', () => { expect(sanitizeFilterValue('A] || status:=Sold')).toBe('A  statusSold'); expect(normalizeArray(['A', 'A'])).toEqual(['A']); });
});
