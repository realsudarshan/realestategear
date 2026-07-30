import { describe, it, expect } from 'vitest';
import { toPropertyDoc } from 'search/transformers';

// Minimum-shape property fixture. Property model has many optional fields;
// these tests focus on the bug being fixed (status + price emission), not full property hydration.
function makeProperty(overrides = {}) {
  return {
    id: 'prop_1',
    address: '123 Main St',
    city: 'Charlotte',
    state: 'NC',
    zipCode: '28202',
    propertyType: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    latitude: 35.2271,
    longitude: -80.8431,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as any;
}

function makeListing(overrides = {}) {
  return {
    status: 'ACTIVE',
    source: 'MLS',
    idxDisplayable: true,
    listPrice: { toString: () => '425000' },
    ...overrides,
  } as any;
}

describe('toPropertyDoc — status + price emission (bug fix)', () => {
  it('emits status="Active" when an active listing is provided', () => {
    const doc = toPropertyDoc(makeProperty(), makeListing());
    expect(doc.status).toBe('Active');
  });

  it('emits price as a number when listing.listPrice is provided', () => {
    const doc = toPropertyDoc(makeProperty(), makeListing({ listPrice: { toString: () => '425000' } }));
    expect(doc.price).toBe(425000);
    expect(typeof doc.price).toBe('number');
  });

  it('emits listing source and IDX displayability for visibility filtering', () => {
    const doc = toPropertyDoc(makeProperty(), makeListing());
    expect(doc.source).toBe('MLS');
    expect(doc.idxDisplayable).toBe(true);
  });

  it('emits status=undefined and price=undefined when no listing is provided', () => {
    const doc = toPropertyDoc(makeProperty());
    expect(doc.status).toBeUndefined();
    expect(doc.price).toBeUndefined();
    expect(doc.source).toBeUndefined();
    expect(doc.idxDisplayable).toBeUndefined();
  });

  it('emits status=undefined and price=undefined when listing is null', () => {
    const doc = toPropertyDoc(makeProperty(), null);
    expect(doc.status).toBeUndefined();
    expect(doc.price).toBeUndefined();
  });

  it('emits price=undefined when listing has null listPrice', () => {
    const doc = toPropertyDoc(makeProperty(), makeListing({ listPrice: null }));
    expect(doc.price).toBeUndefined();
    expect(doc.status).toBe('Active');
  });

  it('normalizes single-word enum status to title case', () => {
    expect(toPropertyDoc(makeProperty(), makeListing({ status: 'ACTIVE' })).status).toBe('Active');
    expect(toPropertyDoc(makeProperty(), makeListing({ status: 'PENDING' })).status).toBe('Pending');
    expect(toPropertyDoc(makeProperty(), makeListing({ status: 'SOLD' })).status).toBe('Sold');
    expect(toPropertyDoc(makeProperty(), makeListing({ status: 'WITHDRAWN' })).status).toBe('Withdrawn');
    expect(toPropertyDoc(makeProperty(), makeListing({ status: 'EXPIRED' })).status).toBe('Expired');
  });

  it('normalizes multi-word enum status with underscores to space-separated title case', () => {
    expect(toPropertyDoc(makeProperty(), makeListing({ status: 'COMING_SOON' })).status).toBe('Coming Soon');
  });

  it('emits subdivision when present on the property', () => {
    const doc = toPropertyDoc(makeProperty({ subdivision: 'Myers Park' }));
    expect(doc.subdivision).toBe('Myers Park');
  });

  it('emits subdivision=undefined when property has no subdivision', () => {
    expect(toPropertyDoc(makeProperty({ subdivision: null })).subdivision).toBeUndefined();
    expect(toPropertyDoc(makeProperty({ subdivision: undefined })).subdivision).toBeUndefined();
  });

  it('preserves all existing property fields (regression — bug fix should not change other behavior)', () => {
    const doc = toPropertyDoc(makeProperty());
    expect(doc.id).toBe('prop_1');
    expect(doc.address).toBe('123 Main St');
    expect(doc.city).toBe('Charlotte');
    expect(doc.state).toBe('NC');
    expect(doc.zipCode).toBe('28202');
    expect(doc.propertyType).toBe('SINGLE_FAMILY');
    expect(doc.bedrooms).toBe(3);
    expect(doc.bathrooms).toBe(2);
    expect(doc.squareFeet).toBe(1800);
    expect(doc.location).toEqual([35.2271, -80.8431]);
    expect(typeof doc.createdAt).toBe('number');
  });
});
