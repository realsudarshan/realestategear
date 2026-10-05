// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentPortalsPage, AgentPortalSettingsPage } from "./agent-portal-management";

const portal = { id: "p1", name: "Austin Portal", slug: "austin", isActive: false, agentEmail: "agent@example.com", brokerageName: "Brokerage", brokeragePhone: "555-0100", featuredListings: [] };
const readiness = { canShowListings: true, canShowSearch: true, blockers: [], warnings: [], gates: [{ id: "agent-email", label: "Agent email set", state: "passed" }] };

describe("Agent portal management", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("creates a portal and reports slug conflicts before saving", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    render(<AgentPortalsPage />);
    await waitFor(() => expect(screen.getByText("No portals yet")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Create portal" }));
    fireEvent.change(screen.getByLabelText("Portal name"), { target: { value: "Austin Portal" } });
    fireEvent.change(screen.getByLabelText("Portal slug", { exact: false }), { target: { value: "austin" } });
    expect(screen.getByText("Slug format is valid.")).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: "Slug is already taken" }) });
    fireEvent.click(screen.getByRole("button", { name: "Create portal" }));
    await waitFor(() => expect(screen.getByText("Slug is already taken")).toBeInTheDocument());
  });
  it("loads settings, readiness, launch checks, and activation", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return { ok: true, status: 200, json: async () => ({ ...portal, isActive: true }) };
      if (url.endsWith("/readiness")) return { ok: true, status: 200, json: async () => readiness };
      if (url.endsWith("/portals")) return { ok: true, status: 200, json: async () => [portal] };
      return { ok: true, status: 200, json: async () => portal };
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AgentPortalSettingsPage id="p1" />);
    await waitFor(() => expect(screen.getByText("Launch readiness")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/portals/p1", expect.objectContaining({ method: "PATCH" })));
  });
  it("uses the presigned URL for logo upload and saves the public URL", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("logo-upload-url")) return { ok: true, status: 200, json: async () => ({ uploadUrl: "https://storage.example/upload", publicUrl: "https://cdn.example/logo.png" }) };
      if (url === "https://storage.example/upload") return { ok: true, status: 200, json: async () => ({}) };
      if (init?.method === "PATCH") return { ok: true, status: 200, json: async () => portal };
      if (url.endsWith("/readiness")) return { ok: true, status: 200, json: async () => readiness };
      if (url.endsWith("/portals")) return { ok: true, status: 200, json: async () => [portal] };
      return { ok: true, status: 200, json: async () => portal };
    });
    render(<AgentPortalSettingsPage id="p1" />);
    await waitFor(() => expect(screen.getByLabelText("Logo")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Logo"), { target: { files: [new File(["logo"], "logo.png", { type: "image/png" })] } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("https://storage.example/upload", expect.objectContaining({ method: "PUT" })));
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/portals/p1", expect.objectContaining({ method: "PATCH" }));
  });
});
