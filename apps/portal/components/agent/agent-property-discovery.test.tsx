// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replace, push } = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/agent/properties",
  useSearchParams: () => new URLSearchParams(),
}));

const { AgentPropertiesPage, AgentListingsPage, AgentListingDetailPage, AgentSearchPalette } = await import("./agent-property-discovery");

describe("Agent property discovery", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); replace.mockReset(); push.mockReset(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("searches properties, preserves filters, and paginates", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ properties: [{ id: "p1", address: "123 Main", city: "Austin", state: "TX", price: 450000, listingId: "l1" }], pagination: { page: 1, limit: 20, total: 21, totalPages: 2 } }) });
    render(<AgentPropertiesPage />);
    await waitFor(() => expect(screen.getByText("123 Main")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Address or MLS ID"), { target: { value: "Main" } });
    expect(replace).toHaveBeenCalledWith("/agent/properties?search=Main");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(replace).toHaveBeenCalledWith("/agent/properties?page=2");
  });

  it("renders no-result and failed-search states with retry", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ properties: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }) });
    render(<AgentPropertiesPage />);
    await waitFor(() => expect(screen.getByText("No properties found")).toBeInTheDocument());
    cleanup();
    fetchMock.mockRejectedValueOnce(new Error("Search unavailable"));
    render(<AgentPropertiesPage />);
    await waitFor(() => expect(screen.getByText("Search unavailable")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders listing search results and listing detail workflow data", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ setup: { hasMlsAccess: true, hasSegments: false, hasDeployedSegments: false, mlsBoards: [] }, defaultFeed: { label: "Newest", listings: [{ id: "l1", address: "123 Main", city: "Austin", state: "TX", price: 450000, status: "Active", mlsId: "AUS001" }] }, segmentFeeds: [] }) });
    render(<AgentListingsPage />);
    await waitFor(() => expect(screen.getByText(/AUS001/)).toBeInTheDocument());
    cleanup();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ listing: { id: "l1", address: "123 Main", city: "Austin", state: "TX", price: 450000, status: "Active", mlsId: "AUS001", listDate: "2026-10-01", brokerage: { name: "Brokerage" } }, property: { propertyType: "SINGLE_FAMILY", bedrooms: 3, bathrooms: 2, squareFeet: 1800, yearBuilt: 2020 }, media: [], propertyHistory: [], workflow: { canCreateTransaction: true, transactions: [] } }) });
    render(<AgentListingDetailPage id="l1" />);
    await waitFor(() => expect(screen.getByText("Transaction workflow")).toBeInTheDocument());
    expect(screen.getByText("No transaction is linked to this property.")).toBeInTheDocument();
  });

  it("opens unified search and requests suggestions", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ suggestions: [{ display: "123 Main" }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ contacts: { items: [], total: 0 }, transactions: { items: [], total: 0 }, properties: { items: [], total: 0 }, tasks: { items: [], total: 0 } }) });
    render(<AgentSearchPalette />);
    fireEvent.click(screen.getByRole("button", { name: "Open global search" }));
    fireEvent.change(screen.getByPlaceholderText("Search contacts, transactions, properties, tasks"), { target: { value: "Main" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/search?q=Main&limit=5"));
    expect(fetchMock).toHaveBeenCalledWith("/api/search/suggestions?q=Main");
  });
});
