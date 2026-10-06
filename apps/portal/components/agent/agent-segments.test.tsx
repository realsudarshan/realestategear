// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentSegmentsPage } from "./agent-segments";

const segment = { id: "s1", name: "Luxury", slug: "luxury", predicate: { propertyTypes: ["SINGLE_FAMILY"], price: { min: 500000, nulls: "exclude" } }, isPublished: false };
describe("Agent listing segments", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); vi.spyOn(window, "confirm").mockReturnValue(true); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it("lists empty state and creates a supported predicate", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => { if (init?.method === "POST") return { ok: true, status: 201, json: async () => segment }; return { ok: true, status: 200, json: async () => url.includes("suggestions") ? { values: { areas: ["downtown"], tags: ["luxury"] } } : [] }; });
    render(<AgentSegmentsPage />);
    await waitFor(() => expect(screen.getByText("No listing collections")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Create segment" }));
    fireEvent.change(screen.getByLabelText("Segment name"), { target: { value: "Luxury" } });
    fireEvent.change(screen.getByLabelText("Segment slug"), { target: { value: "luxury" } });
    fireEvent.click(screen.getByLabelText("SINGLE_FAMILY"));
    fireEvent.click(screen.getByRole("button", { name: "Create segment" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/segments", expect.objectContaining({ method: "POST" })));
  });
  it("supports edit, count preview, and delete", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => { if (url.includes("listing-count")) return { ok: true, status: 200, json: async () => ({ count: 4, minPrice: null, maxPrice: null }) }; if (init?.method === "DELETE") return { ok: true, status: 204, json: async () => ({}) }; return { ok: true, status: 200, json: async () => url.includes("suggestions") ? { values: {} } : [segment] }; });
    render(<AgentSegmentsPage />);
    await waitFor(() => expect(screen.getByText("Luxury")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Preview listing count" }));
    await waitFor(() => expect(screen.getByText("4 matching listings")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("Edit segment")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/segments/s1", expect.objectContaining({ method: "DELETE" })));
  });
  it("rejects invalid predicate form values before calling the API", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ values: {} }) });
    render(<AgentSegmentsPage />);
    await waitFor(() => expect(screen.getByText("No listing collections")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Create segment" }));
    fireEvent.change(screen.getByLabelText("Segment name"), { target: { value: "Bad" } });
    fireEvent.change(screen.getByLabelText("Segment slug"), { target: { value: "Not Valid" } });
    fireEvent.click(screen.getByRole("button", { name: "Create segment" }));
    expect(screen.getByText("Name and a stable lowercase slug are required.")).toBeInTheDocument();
  });
});
