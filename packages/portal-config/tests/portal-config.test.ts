import { describe, expect, it } from 'vitest';
import {
  getMlsBoardPolicy,
  getPortalConfig,
  getPortalListingPolicy,
  classifierExpressionSchema,
  collectionPredicateSchema,
  classificationConfigHash,
  evaluateClassifier,
  validatePortalConfig,
} from '../src/index.js';
import { carolinaGolfHomesClassification } from './fixtures/carolina-golf-homes.js';

// portal.config.ts is the one file every deployment edits ("fork this repo and
// edit these values"), so these assert invariants that must hold for ANY valid
// deployment rather than the placeholder values this repository ships. Pinning
// the literals here failed every fork the moment it did what the file asks.
describe('portal config', () => {
  it('returns this deployment\'s one portal config', () => {
    const config = getPortalConfig();
    expect(config.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(config.name.trim().length).toBeGreaterThan(0);
    expect(config.domains.length).toBeGreaterThan(0);
  });

  // Only the shape is asserted. Whether a portal may actually show listings is
  // decided by getPortalReadiness (the idx-approval gate), not here —
  // mode 'db' with idxApproved false is a legitimate mid-setup state for a
  // deployment wiring up listings before its board approval lands, and
  // portalReadinessService.unit.test.ts already covers that gate.
  it('resolves a valid listing policy', () => {
    const policy = getPortalListingPolicy();

    expect(['hidden', 'mock', 'db']).toContain(policy.mode);
    expect(Array.isArray(policy.boardIds)).toBe(true);
  });
});

describe('classification config', () => {
  it('keeps generic defaults neutral', () => {
    expect(getPortalConfig().classification.definitions).toEqual([]);
    expect(getPortalConfig().classification.initialAreas).toEqual([]);
  });

  it('validates the documented Carolina fixture without making it a runtime default', () => {
    for (const definition of carolinaGolfHomesClassification.definitions) classifierExpressionSchema.parse(definition.classifier);
    for (const collection of carolinaGolfHomesClassification.initialCollections) collectionPredicateSchema.parse(collection.predicate);
  });

  it('hashes canonically and evaluates place/radius/composite classifiers', () => {
    expect(classificationConfigHash({ b: 2, a: 1 })).toBe(classificationConfigHash({ a: 1, b: 2 }));
    expect(evaluateClassifier({ kind: 'place', cities: ['Cornelius'] }, { city: 'cornelius', attributes: {} }).matched).toBe(true);
    expect(evaluateClassifier({ kind: 'composite', operator: 'all', definitions: [{ kind: 'place', zipCodes: ['28031'] }, { kind: 'radius', latitude: 35.48, longitude: -80.86, miles: 10 }] }, { zipCode: '28031', latitude: 35.49, longitude: -80.85, attributes: {} }).matched).toBe(true);
  });

  it('rejects unstable configured slugs', () => {
    const config = structuredClone(getPortalConfig());
    config.classification.definitions = [{ slug: 'Golf Front', label: 'Bad', classifier: { kind: 'fields', all: [] } }];
    expect(() => validatePortalConfig(config)).toThrow(/stable lowercase slugs/);
  });
});

describe('MLS board policy', () => {
  it('requires attribution on listing detail but not the listing card for Canopy MLS', () => {
    const policy = getMlsBoardPolicy('CanopyMLS');
    expect(policy.surfaces.portalListingCard.attributionRequired).toBe(false);
    expect(policy.surfaces.listingDetail.attributionRequired).toBe(true);
    expect(policy.surfaces.listingDetail.requiresListingBrokerage).toBe(true);
    expect(policy.surfaces.portalFooter.disclaimerRequired).toBe(true);
  });

  it('fails loud for an unregistered board', () => {
    expect(() => getMlsBoardPolicy('SomeOtherMLS')).toThrow('No MLS board policy registered for "SomeOtherMLS".');
  });
});
