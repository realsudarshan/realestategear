// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentReportsPage } from "./agent-reports";

describe("Agent reports", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); vi.spyOn(window, "confirm").mockReturnValue(true); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const base = { window: { from: "2026-01-01", to: "2026-12-31" }, closings: 2, volume: 500000, commission: 15000, missingDataCount: 0, prev: { closings: 1, volume: 200000, commission: 5000 }, deltaPct: { closings: 100, volume: 150, commission: 200 } };
  const forecast = { projectedClosings: 1.2, projectedVolume: 300000, projectedCommission: 9000, byStage: [] };
  it("renders summary, chart data, and clearly labeled forecast", async () => {
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url.includes("summary") ? base : url.includes("trend") ? { points: [{ bucket: "2026-01-01", closings: 2, volume: 500000, commission: 15000 }] } : url.includes("forecast") ? forecast : { reports: [], pagination: { page: 1, totalPages: 0, total: 0 } } }));
    render(<AgentReportsPage />);
    await waitFor(() => expect(screen.getByText("$500,000")).toBeInTheDocument());
    expect(screen.getByText("Forecast")).toBeInTheDocument();
    expect(screen.getByText(/not guaranteed results/i)).toBeInTheDocument();
  });
  it("shows no-data state and supports report generation", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => ({ ok: true, status: 200, json: async () => init?.method === "POST" ? {} : url.includes("summary") ? base : url.includes("trend") ? { points: [] } : url.includes("forecast") ? forecast : { reports: [], pagination: { page: 1, totalPages: 0, total: 0 } } }));
    render(<AgentReportsPage />);
    await waitFor(() => expect(screen.getByText("No trend data")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText("Property ID for report generation")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Property ID for report generation"), { target: { value: "property-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate report" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/market-reports/generate", expect.objectContaining({ method: "POST" })));
  });
  it("handles API failures with retry", async () => {
    fetchMock.mockRejectedValue(new Error("Network unavailable"));
    render(<AgentReportsPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Network unavailable"));
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
  it("supports market report create, edit, and delete actions", async () => {
    const report = { id: "r1", title: "Spring CMA", subjectPropertyAddress: "1 Main St", status: "DRAFT" };
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => ({ ok: true, status: init?.method === "DELETE" ? 204 : 200, json: async () => init?.method === "POST" || init?.method === "PUT" ? report : url.includes("summary") ? base : url.includes("trend") ? { points: [] } : url.includes("forecast") ? forecast : { reports: [report], pagination: { page: 1, totalPages: 1, total: 1 } } }));
    render(<AgentReportsPage />);
    await waitFor(() => expect(screen.getByLabelText("Market report title")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Market report title"), { target: { value: "Spring CMA" } });
    fireEvent.change(screen.getByLabelText("Subject property address"), { target: { value: "1 Main St" } });
    fireEvent.click(screen.getByRole("button", { name: "Create report" }));
    await waitFor(() => expect(screen.getByText("Spring CMA")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save report" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/market-reports/r1", expect.objectContaining({ method: "PUT" })));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/market-reports/r1", expect.objectContaining({ method: "DELETE" })));
  });
});
