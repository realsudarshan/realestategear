import type { PortalConfig } from './types.js';

// This is YOUR portal's configuration. Each deployment of this toolkit is
// one portal — fork this repo and edit these values for your own brand,
// domain, MLS board, and listing policy. There is no registry of many
// portals to resolve between; this file IS your portal.
export const portalConfig: PortalConfig = {
  slug: 'example-realty',
  name: 'Example Realty',
  domains: ['example-realty.localhost', 'localhost'],
  theme: {
    preset: 'default',
    primary: '#171717',
  },
  listings: {
    mode: 'hidden',
    boardIds: [],
    collectionSlugs: [],
  },
  features: {
    search: true,
    map: false,
    inquiryForm: true,
    savedSearch: false,
  },
  compliance: {
    idxApproved: false,
    brokerageName: 'Example Realty',
    brokeragePhone: '(704) 555-0100',
    publicListingDisplay: 'hidden',
  },
  classification: {
    version: '1',
    providerAttributeMappings: {},
    definitions: [],
    advancedClassifiers: {},
    initialAreas: [],
    initialCollections: [],
  },
};
