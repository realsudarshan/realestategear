import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPortalListings, getPortalProperty } from "./listings";

describe("getPortalListings", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends every provided filter as a query param and returns the parsed result on success", async () => {
    const apiResult = { properties: [{ id: "1" }], pagination: { page: 1 }, readiness: { canShowListings: true } };
    fetchMock.mockResolvedValue({ ok: true, json: async () => apiResult });

    const result = await getPortalListings({
      q: "Lakeview",
      minPrice: 300000,
      maxPrice: 750000,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: "CONDO",
      sortBy: "yearBuilt",
      sortOrder: "desc",
      page: 2,
    });

    expect(result).toEqual(apiResult);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0];
    const query = new URL(url).searchParams;
    expect(query.get("q")).toBe("Lakeview");
    expect(query.get("minPrice")).toBe("300000");
    expect(query.get("maxPrice")).toBe("750000");
    expect(query.get("bedrooms")).toBe("3");
    expect(query.get("bathrooms")).toBe("2");
    expect(query.get("propertyType")).toBe("CONDO");
    expect(query.get("sortBy")).toBe("yearBuilt");
    expect(query.get("sortOrder")).toBe("desc");
    expect(query.get("page")).toBe("2");
  });

  it("returns the empty result when the API responds with a non-ok status", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "boom" }) });

    const result = await getPortalListings({ q: "Lakeview" });

    expect(result.properties).toEqual([]);
    expect(result.readiness.canShowListings).toBe(false);
  });

  it("returns the empty result when fetch throws (network failure)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await getPortalListings({ q: "Lakeview" });

    expect(result.properties).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });
});

describe("getPortalProperty", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("uses the portal-scoped detail endpoint and returns its typed payload", async () => {
    const property = { id: "property-1", slug: "123-main-st", address: "123 Main St" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => property });

    await expect(getPortalProperty("123 main/st")).resolves.toEqual(property);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/portals/slug/example-realty/properties/123%20main%2Fst"),
      { cache: "no-store" },
    );
  });

  it("returns null for an ineligible, missing, or unavailable property", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    await expect(getPortalProperty("missing")).resolves.toBeNull();
  });
});
