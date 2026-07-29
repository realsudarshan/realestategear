// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'; import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./site-header', () => ({ SiteHeader: () => <header /> })); vi.mock('./site-footer', () => ({ SiteFooter: () => <footer /> }));
import { ListingLanding } from './listing-landing';
const readiness = { listingMode: 'db' as const, publicListingDisplay: 'real' as const, canShowSearch: true, canShowListings: true, configSource: 'code' as const, gates: [], blockers: [], warnings: [] };
afterEach(cleanup);
describe('public listing landing', () => {
  it('shows a gated state and carries area attribution to inquiry', () => { render(<ListingLanding kind="area" landing={{ metadata: { id: 'a1', slug: 'lake-norman', name: 'Lake Norman', description: null }, properties: [], readiness, gated: true }} />); expect(screen.getByText('Listings are not available yet')).toBeInTheDocument(); expect(screen.getByRole('link', { name: /ask about/i })).toHaveAttribute('href', '/contact?area=lake-norman'); });
  it('shows an explicit empty collection state', () => { render(<ListingLanding kind="collection" landing={{ metadata: { id: 'c1', slug: 'golf-homes', name: 'Golf homes', description: null }, properties: [], readiness, gated: false }} />); expect(screen.getByText('No matching homes right now')).toBeInTheDocument(); expect(screen.getByRole('link', { name: /ask about/i })).toHaveAttribute('href', '/contact?collection=golf-homes'); });
});
