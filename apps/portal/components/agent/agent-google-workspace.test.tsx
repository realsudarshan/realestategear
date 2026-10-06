// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentGoogleWorkspacePage, GoogleCalendar, GoogleContactActivity } from "./agent-google-workspace";

const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
describe("Agent Google Workspace", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); vi.spyOn(window, "confirm").mockReturnValue(true); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it("shows disconnected status, scopes, and handles OAuth failure", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => { if (init?.method === "POST") return response({ error: "Google consent denied" }, 400); if (url.includes("/scopes")) return response({ provider: "google", scopes: ["openid", "email"] }); if (url.includes("/calendar")) return response({ events: [], nextPageToken: null }); return response({ connected: false, provider: "google", availableScopes: ["openid", "email"] }); });
    render(<AgentGoogleWorkspacePage />);
    await waitFor(() => expect(screen.getByText("Disconnected")).toBeInTheDocument());
    expect(screen.getByText("openid")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Google authorization code"), { target: { value: "bad" } });
    fireEvent.change(screen.getByLabelText("Google redirect URI"), { target: { value: "https://app.test/callback" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));
    await waitFor(() => expect(screen.getByText("Google consent denied")).toBeInTheDocument());
  });
  it("shows connected status and disconnects after confirmation", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => { if (init?.method === "DELETE") return response({ disconnected: true }); if (url.includes("/scopes")) return response({ scopes: ["calendar"] }); if (url.includes("/calendar")) return response({ events: [], nextPageToken: null }); return response({ connected: true, provider: "google", email: "agent@example.com", displayName: "Agent", scopes: ["calendar"], lastSyncedAt: "2026-01-01T00:00:00Z" }); });
    render(<AgentGoogleWorkspacePage />);
    await waitFor(() => expect(screen.getByText(/agent@example.com/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/google/connection", expect.objectContaining({ method: "DELETE" })));
  });
  it("loads calendar pages and contact activity", async () => {
    fetchMock.mockImplementation(async (url: string) => { if (url.includes("/calendar")) return response(url.includes("pageToken") ? { events: [{ id: "e2", title: "Later", start: null }], nextPageToken: null } : { events: [{ id: "e1", title: "Tour", start: "2026-01-01" }], nextPageToken: "next" }); return response({ contact: { id: "c1", name: "Alex", email: "alex@example.com" }, emails: [{ id: "m1", subject: "Hello", from: "alex@example.com" }], events: [] }); });
    render(<GoogleCalendar />);
    await waitFor(() => expect(screen.getByText("Tour")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Later")).toBeInTheDocument());
    render(<GoogleContactActivity contactId="c1" />);
    await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());
  });
});
