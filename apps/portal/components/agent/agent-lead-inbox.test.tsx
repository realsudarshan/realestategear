// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentLeadInbox } from "./agent-lead-inbox";

const inquiry = { id: "i1", portalId: "p1", status: "NEW", visitorName: "Taylor Visitor", visitorEmail: "taylor@example.com", visitorPhone: null, message: "Interested in 123 Main", createdAt: "2026-10-01T00:00:00.000Z", property: { address: "123 Main", city: "Austin", state: "TX" }, portal: { id: "p1", name: "Austin Portal" } };

describe("Agent lead inbox", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("filters, shows counts, paginates, and opens inquiry details", async () => {
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url.includes("status=") ? { inquiries: [], pagination: { page: 1, limit: 1, total: 2, totalPages: 2 } } : { inquiries: [inquiry], pagination: { page: 1, limit: 20, total: 2, totalPages: 2 } } }));
    render(<AgentLeadInbox />);
    await waitFor(() => expect(screen.getByText("Taylor Visitor")).toBeInTheDocument());
    expect(screen.getByText("Interested in 123 Main")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /READ/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/inquiries?page=1&limit=20&status=READ", expect.anything()));
  });

  it("marks read, archives, and responds through supported endpoints", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH" || init?.method === "PUT") return { ok: true, status: 200, json: async () => inquiry };
      return { ok: true, status: 200, json: async () => url.includes("status=") ? { inquiries: [], pagination: { page: 1, limit: 1, total: 1, totalPages: 1 } } : { inquiries: [inquiry], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } } };
    });
    render(<AgentLeadInbox />);
    await waitFor(() => expect(screen.getByText("Taylor Visitor")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/portals/p1/inquiries/i1", expect.objectContaining({ method: "PATCH" })));
    fireEvent.click(screen.getByText("Taylor Visitor"));
    fireEvent.change(screen.getByLabelText("Inquiry response"), { target: { value: "Thanks for reaching out." } });
    fireEvent.click(screen.getByRole("button", { name: "Respond" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/inquiries/i1/respond", expect.objectContaining({ method: "PUT" })));
  });

  it("handles unauthorized and export behavior", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) });
    render(<AgentLeadInbox />);
    await waitFor(() => expect(screen.getByText("Your Agent session has expired.")).toBeInTheDocument());
    cleanup();
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url.includes("status=") ? { inquiries: [], pagination: { page: 1, limit: 1, total: 0, totalPages: 0 } } : { inquiries: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } }));
    render(<AgentLeadInbox />);
    await waitFor(() => expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute("href", "/api/proxy/owner/leads/export.csv?"));
  });
});
