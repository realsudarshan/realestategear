import type { PortalClassificationConfig } from '../../src/types.js';

// Documentation/example only. This is intentionally not imported by runtime defaults.
export const carolinaGolfHomesClassification: PortalClassificationConfig = {
  version: 'cgh-example-v1',
  providerAttributeMappings: {
    mlsgrid: { golfView: ['View', 'CommunityFeatures'], golfFront: ['LotFeatures'] },
  },
  definitions: [
    { slug: 'golf-front', label: 'Golf front', classifier: { kind: 'fields', all: [{ field: 'LotFeatures', operator: 'includesAny', values: ['On Golf Course', 'Golf Course Frontage'] }] } },
    { slug: 'golf-view', label: 'Golf view', classifier: { kind: 'fields', all: [{ field: 'View', operator: 'includesAny', values: ['Golf Course'] }] } },
    { slug: 'golf-community', label: 'Golf community', classifier: { kind: 'fields', all: [{ field: 'CommunityFeatures', operator: 'includesAny', values: ['Golf'] }] } },
    { slug: 'near-golf', label: 'Near golf', classifier: { kind: 'radius', latitude: 35.4993, longitude: -80.8487, miles: 5 } },
  ],
  advancedClassifiers: {},
  initialAreas: [{ slug: 'lake-norman', name: 'Lake Norman', definition: { kind: 'place', cities: ['Cornelius', 'Davidson', 'Huntersville', 'Mooresville'] } }],
  initialCollections: [{ slug: 'golf-homes', name: 'Golf homes', predicate: { areaSlugs: ['lake-norman'], tagsAny: ['golf-front', 'golf-view', 'golf-community', 'near-golf'] } }],
};
