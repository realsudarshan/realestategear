// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentCampaignDetail, AgentCampaignsPage } from "./agent-campaigns";

describe("Agent campaigns", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("lists campaigns and creates a campaign draft", async () => {
    const campaign = { id: "c1", name: "Spring", type: "EMAIL", status: "DRAFT" };
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => ({ ok: true, status: init?.method === "POST" ? 201 : 200, json: async () => init?.method === "POST" ? campaign : { campaigns: [], pagination: { total: 0, totalPages: 0 } } }));
    render(<AgentCampaignsPage />);
    await waitFor(() => expect(screen.getByText("No campaigns")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Create campaign" }));
    fireEvent.change(screen.getByLabelText("Campaign name"), { target: { value: "Spring" } });
    fireEvent.click(screen.getByRole("button", { name: "Create campaign" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/campaigns", expect.objectContaining({ method: "POST" })));
  });
  it("shows AI loading, editable generated content, and saves an edited draft", async () => {
    const campaign = { id: "c1", name: "Spring", type: "EMAIL", status: "DRAFT", content: {} };
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/ai/")) return { ok: true, status: 200, json: async () => ({ content: "Draft copy" }) };
      if (init?.method === "PUT") return { ok: true, status: 200, json: async () => ({ ...campaign, content: { body: "Edited copy" } }) };
      return { ok: true, status: 200, json: async () => campaign };
    });
    render(<AgentCampaignDetail id="c1" />);
    await waitFor(() => expect(screen.getByText("Spring")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("AI context"), { target: { value: "Spring buyers" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate draft" }));
    await waitFor(() => expect(screen.getByDisplayValue("Draft copy")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Generated content"), { target: { value: "Edited copy" } });
    fireEvent.click(screen.getByRole("button", { name: "Use edited content" }));
    expect(screen.getByText("Edit campaign")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save campaign" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/campaigns/c1", expect.objectContaining({ method: "PUT" })));
  });
  it("handles AI errors and exposes unsaved-change protection", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/ai/")) return { ok: false, status: 503, json: async () => ({ error: "AI unavailable" }) };
      return { ok: true, status: 200, json: async () => ({ id: "c1", name: "Spring", type: "EMAIL", status: "DRAFT", content: {} }) };
    });
    render(<AgentCampaignDetail id="c1" />);
    await waitFor(() => expect(screen.getByText("Spring")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit campaign" }));
    expect(screen.getByText(/review and edit/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("AI context"), { target: { value: "buyers" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate draft" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("AI unavailable"));
    expect(screen.getByText("Edit campaign")).toBeInTheDocument();
  });
  it("handles list API failure with retry", async () => {
    fetchMock.mockRejectedValue(new Error("Campaign API unavailable"));
    render(<AgentCampaignsPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Campaign API unavailable"));
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
