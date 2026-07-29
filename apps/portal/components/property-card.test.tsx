// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PropertyCard } from "./property-card";
import type { PortalPropertySummary } from "@/lib/listings";

afterEach(() => cleanup());

function property(overrides: Partial<PortalPropertySummary> = {}): PortalPropertySummary {
  return {
    id: "1",
    address: "123 Main St",
    city: "Charlotte",
    state: "NC",
    zipCode: "28202",
    subdivision: null,
    price: 450000,
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    imageUrl: "https://example.com/photo.jpg",
    slug: "123-main-st",
    status: "ACTIVE",
    listingId: "l1",
    ...overrides,
  };
}

describe("PropertyCard", () => {
  it("renders price, address, facts, and image when all fields are present", () => {
    render(<PropertyCard property={property()} />);

    expect(screen.getByText("123 Main St")).toBeInTheDocument();
    expect(screen.getByText("Charlotte, NC 28202")).toBeInTheDocument();
    expect(screen.getByText("$450,000")).toBeInTheDocument();
    expect(screen.getByText(/3 bd/)).toBeInTheDocument();
    expect(screen.getByText(/2 ba/)).toBeInTheDocument();
    expect(screen.getByText(/1,800 sqft/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "123 Main St" })).toHaveAttribute(
      "src",
      "https://example.com/photo.jpg"
    );
    expect(screen.getByRole("link", { name: /123 Main St/ })).toHaveAttribute(
      "href",
      "/properties/123-main-st",
    );
  });

  it("omits the price badge, facts line, and image when those fields are null", () => {
    render(
      <PropertyCard
        property={property({ price: null, bedrooms: null, bathrooms: null, squareFeet: null, imageUrl: null })}
      />
    );

    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/bd/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ba/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sqft/)).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("joins only the present facts without stray separators when some fields are null", () => {
    render(<PropertyCard property={property({ bathrooms: null, squareFeet: null })} />);

    expect(screen.getByText("3 bd")).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("falls back to the stable property id when a listing has no slug", () => {
    render(<PropertyCard property={property({ id: "property-1", slug: null })} />);

    expect(screen.getByRole("link", { name: /123 Main St/ })).toHaveAttribute(
      "href",
      "/properties/property-1",
    );
  });
});
