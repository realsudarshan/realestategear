// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerLeadsInbox, type LeadsResponse } from "./owner-leads-inbox";

const initial: LeadsResponse = {
  leads: [{
    id: "i1", source: "PORTAL_ANONYMOUS", status: "NEW", visitorName: "Ada Buyer",
    visitorEmail: "ada@example.com", visitorPhone: "555-0100", message: "I would like a tour.",
    contactPreference: "EMAIL", areaSnapshot: null, collectionSnapshot: null, createdAt: "2026-07-01T12:00:00Z",
    portal: { name: "Portal" }, listing: { id: "l1", slug: "home", property: { address: "1 Main St", city: "Myrtle Beach", state: "SC" } },
  }],
  nextCursor: null,
  counts: { NEW: 1, READ: 0, RESPONDED: 0, ARCHIVED: 0, total: 1 },
};

describe("OwnerLeadsInbox", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it("renders lead context and contact/status actions", () => {
    render(<OwnerLeadsInbox initial={initial} />);
    expect(screen.getByText("Ada Buyer")).toBeInTheDocument();
    expect(screen.getByText(/1 Main St/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ada@example.com" })).toHaveAttribute("href", "mailto:ada@example.com");
    expect(screen.getByRole("button", { name: "Mark read" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute("href", expect.stringContaining("/api/proxy/owner/leads/export.csv"));
  });

  it("updates a lead and exposes API errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...initial.leads[0], status: "READ" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Update failed" }), { status: 500 }));
    render(<OwnerLeadsInbox initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/proxy/owner/leads/i1", expect.objectContaining({ method: "PATCH" })));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mark read" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Update failed");
  });

  it("shows empty and loading states while filtering", async () => {
    let resolveRequest!: (value: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<OwnerLeadsInbox initial={{ ...initial, leads: [], counts: { NEW: 0, READ: 0, RESPONDED: 0, ARCHIVED: 0, total: 0 } }} />);
    expect(screen.getByText("No leads in this view.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "PORTAL_AUTHENTICATED" } });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    resolveRequest(new Response(JSON.stringify({ ...initial, leads: [] }), { status: 200 }));
    await waitFor(() => expect(screen.queryByText("Loading...")).not.toBeInTheDocument());
  });
});
