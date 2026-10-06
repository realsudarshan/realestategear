// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentPortalSettingsPage } from "./agent-portal-management";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const portal = { id: "p1", name: "Austin Portal", slug: "austin", isActive: false, agentEmail: "agent@example.com", brokerageName: "Brokerage", brokeragePhone: "555-0100", featuredListings: [] };
const readiness = { canShowListings: true, canShowSearch: true, blockers: [], warnings: [], gates: [] };

describe("Agent custom domains", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); vi.spyOn(window, "confirm").mockReturnValue(true); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function setup(domains: unknown[]) {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/domains") && init?.method === "POST") return { ok: true, status: 201, json: async () => domains[0] };
      if (url.includes("/domains/") && init?.method === "POST") return { ok: true, status: 200, json: async () => domains[0] };
      if (url.includes("/canonical")) return { ok: true, status: 200, json: async () => domains[0] };
      if (url.includes("/domains/") && init?.method === "DELETE") return { ok: true, status: 204, json: async () => ({}) };
      if (url.endsWith("/domains")) return { ok: true, status: 200, json: async () => domains };
      if (url.endsWith("/readiness")) return { ok: true, status: 200, json: async () => readiness };
      if (url.endsWith("/portals")) return { ok: true, status: 200, json: async () => [portal] };
      return { ok: true, status: 200, json: async () => portal };
    });
  }

  it("shows pending DNS instructions and verifies a domain", async () => {
    const domain = { id: "d1", hostname: "www.example.com", status: "PENDING", canonical: false, verificationToken: "token-123" };
    setup([domain]);
    render(<AgentPortalSettingsPage id="p1" />);
    await waitFor(() => expect(screen.getByText("www.example.com")).toBeInTheDocument());
    expect(screen.getByText(/Create a TXT record/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verify DNS" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/portals/p1/domains/d1/verify", expect.objectContaining({ method: "POST" })));
  });

  it("adds a domain, sets canonical, and removes it", async () => {
    const domain = { id: "d1", hostname: "example.com", status: "ACTIVE", canonical: false };
    setup([domain]);
    render(<AgentPortalSettingsPage id="p1" />);
    await waitFor(() => expect(screen.getByText("Custom domains")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Domain hostname"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add domain" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/portals/p1/domains", expect.objectContaining({ method: "POST" })));
    fireEvent.click(screen.getByRole("button", { name: "Set canonical" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/portals/p1/domains/d1/canonical", expect.objectContaining({ method: "PATCH" })));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/portals/p1/domains/d1", expect.objectContaining({ method: "DELETE" })));
  });

  it("renders failed and unauthorized states", async () => {
    const domain = { id: "d1", hostname: "bad.example.com", status: "FAILED", canonical: false, verificationToken: "token" };
    setup([domain]);
    render(<AgentPortalSettingsPage id="p1" />);
    await waitFor(() => expect(screen.getByText("Status: FAILED")).toBeInTheDocument());
    cleanup();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) });
    render(<AgentPortalSettingsPage id="p1" />);
    await waitFor(() => expect(screen.getByText("UNAUTHORIZED")).toBeInTheDocument());
  });
});
