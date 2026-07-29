import { describe, expect, it } from 'vitest';
import { compileCollectionPredicate, evaluateCollectionPredicate } from './collectionPredicate.js';
const home = { areaSlugs: ['lake-norman'], tags: ['golf-front', 'near-golf'], propertyType: 'SINGLE_FAMILY', price: 900000, beds: 4, baths: 3.5, sqft: 3200, lotSize: 0.5, yearBuilt: 2018 };
describe('collection predicate semantics', () => {
  it('ORs within groups, ANDs across groups, and lets exclusions veto', () => {
    expect(evaluateCollectionPredicate({ areaSlugs: ['other', 'lake-norman'], tagsAny: ['golf-view', 'golf-front'], propertyTypes: ['SINGLE_FAMILY'] }, home)).toBe(true);
    expect(evaluateCollectionPredicate({ tagsAny: ['golf-front'], tagsExclude: ['near-golf'] }, home)).toBe(false);
    expect(evaluateCollectionPredicate({ tagsAll: ['golf-front', 'golf-view'] }, home)).toBe(false);
  });
  it('applies explicit null behavior', () => {
    const unknown = { ...home, sqft: null };
    expect(evaluateCollectionPredicate({ sqft: { min: 1000, nulls: 'exclude' } }, unknown)).toBe(false);
    expect(evaluateCollectionPredicate({ sqft: { min: 1000, nulls: 'include' } }, unknown)).toBe(true);
    expect(evaluateCollectionPredicate({ sqft: { nulls: 'only' } }, unknown)).toBe(true);
  });
  it('compiles authoritative Postgres eligibility and override precedence', () => {
    const where = compileCollectionPredicate({ tagsAny: ['golf-front'] }, { accountId: 'a1', portalId: 'p1', boardIds: ['board-1'], collectionId: 'c1' });
    const serialized = JSON.stringify(where);
    expect(serialized).toContain('"status":"ACTIVE"');
    expect(serialized).toContain('"idxDisplayable":true');
    expect(serialized).toContain('"mlsBoardId":{"in":["board-1"]}');
    expect(serialized).toContain('"decision":"EXCLUDE"');
    expect(serialized).toContain('"decision":"INCLUDE"');
  });
  it('treats an empty predicate as all eligible properties without requiring an include override', () => {
    const where = compileCollectionPredicate({}, { accountId: 'a1', portalId: 'p1', boardIds: ['board-1'], collectionId: 'c1' });
    const serialized = JSON.stringify(where);
    expect(serialized).toContain('"decision":"EXCLUDE"');
    expect(serialized).not.toContain('"decision":"INCLUDE"');
  });
});
