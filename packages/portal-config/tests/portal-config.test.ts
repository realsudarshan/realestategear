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

describe('portal config', () => {
  it('returns this deployment\'s one portal config', () => {
    const config = getPortalConfig();
    expect(config.slug).toBe('example-realty');
    expect(config.name).toBe('Example Realty');
  });

  it('keeps the template portal hidden until MLS approval is configured', () => {
    const policy = getPortalListingPolicy();
    expect(policy.mode).toBe('hidden');
    expect(policy.boardIds).toEqual([]);
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
