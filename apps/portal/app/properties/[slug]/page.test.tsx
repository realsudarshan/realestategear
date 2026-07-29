// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPortalProperty = vi.hoisted(() => vi.fn());
const mockNotFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("@/lib/listings", () => ({ getPortalProperty: mockGetPortalProperty }));
vi.mock("next/navigation", () => ({ notFound: mockNotFound }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => <header>Header</header> }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => <footer>Footer</footer> }));

const { default: PropertyDetailPage, generateMetadata } = await import("./page");

const PROPERTY = {
  id: "property-1",
  listingId: "listing-1",
  slug: "123-main-st",
  address: "123 Main St",
  city: "Charlotte",
  state: "NC",
  zipCode: "28202",
  subdivision: null,
  price: 450000,
  bedrooms: 3,
  bathrooms: 2,
  squareFeet: 1800,
  imageUrl: "https://example.com/home.jpg",
  status: "ACTIVE",
  propertyType: "SINGLE_FAMILY",
  lotSize: 0.25,
  yearBuilt: 2019,
  latitude: null,
  longitude: null,
  description: "A bright home near the city.",
  mlsId: "CAR123",
  mlsBoardId: "CanopyMLS",
  mlsBoardName: "Canopy MLS",
  listingDate: "2026-07-01T00:00:00.000Z",
  lastMlsUpdate: "2026-07-20T00:00:00.000Z",
  listingAgentName: "Jane Agent",
  brokerageName: "Example Realty",
  brokeragePhone: "704-555-0100",
  media: [{ id: "media-1", url: "https://example.com/home.jpg", caption: "Front exterior" }],
};

describe("PropertyDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPortalProperty.mockResolvedValue(PROPERTY);
  });

  afterEach(() => cleanup());

  it("server-renders eligible property details and JSON-LD", async () => {
    const { container } = render(await PropertyDetailPage({ params: Promise.resolve({ slug: "123-main-st" }) }));

    expect(screen.getByRole("heading", { name: "123 Main St" })).toBeInTheDocument();
    expect(screen.getByText("$450,000")).toBeInTheDocument();
    expect(screen.getByText("A bright home near the city.")).toBeInTheDocument();
    expect(container.querySelector('script[type="application/ld+json"]')?.textContent).toContain('"price":450000');
  });

  it("generates property metadata from the eligible portal response", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "123-main-st" }) });

    expect(metadata.title).toContain("123 Main St");
    expect(metadata.alternates?.canonical).toContain("/properties/123-main-st");
  });

  it("renders the not-found boundary when the portal API rejects the property", async () => {
    mockGetPortalProperty.mockResolvedValue(null);

    await expect(PropertyDetailPage({ params: Promise.resolve({ slug: "outside-scope" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledOnce();
  });
});
