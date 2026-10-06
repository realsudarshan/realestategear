// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentAiWorkspace } from "./agent-ai-workspace";

const action = { id: "a1", toolName: "draft", toolType: "LEAD_RESPONSE", label: "Review lead response", reason: "Lead needs a reply", payload: {}, status: "PENDING", requiresConfirmation: true, priority: 1 };
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("Agent AI workspace", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); vi.spyOn(window, "confirm").mockReturnValue(true); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("renders an empty queue and streams chat without calling execute", async () => {
    const encoder = new TextEncoder();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/chat")) return { ok: true, status: 200, body: new ReadableStream({ start(controller) { controller.enqueue(encoder.encode('data: {"content":"Hello"}\n\ndata: {"done":true,"entities":[]}\n\n')); controller.close(); } }) };
      if (url.endsWith("/conversations")) return response([]);
      return response({ actions: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } });
    });
    render(<AgentAiWorkspace />);
    await waitFor(() => expect(screen.getByText("Queue is empty")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("AI message"), { target: { value: "What needs attention?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/execute"))).toBe(false);
  });

  it("reviews, snoozes, dismisses, and executes only after confirmation", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/actions")) return response({ actions: [action], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } });
      if (url.endsWith("/actions/a1")) return response(action);
      if (init?.method === "POST") return response({ ...action, status: "APPROVED" });
      return response([]);
    });
    render(<AgentAiWorkspace />);
    await waitFor(() => expect(screen.getByText("Review lead response")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Review lead response/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Execute action" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/ai/actions/a1/review", expect.objectContaining({ method: "POST" })));
    fireEvent.click(screen.getByRole("button", { name: /Review lead response/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Execute action" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Execute action" }));
    expect(screen.getByText("Confirm side effect")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm execute" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/ai/actions/a1/execute", expect.objectContaining({ method: "POST" })));
  });

  it("shows partial execution as incomplete instead of success", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/actions")) return response({ actions: [action], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } });
      if (url.endsWith("/actions/a1")) return response(action);
      if (String(url).endsWith("/execute")) return response({ error: "Email sent but CRM update failed", partial: true }, 207);
      if (init?.method === "POST") return response(action);
      return response([]);
    });
    render(<AgentAiWorkspace />);
    await waitFor(() => expect(screen.getByText("Review lead response")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Review lead response/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Execute action" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Execute action" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm execute" }));
    await waitFor(() => expect(screen.getByText(/Execution was partial/i)).toBeInTheDocument());
    expect(screen.queryByText("Action executed successfully")).not.toBeInTheDocument();
  });
  it("calls snooze and dismiss endpoints", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/actions")) return response({ actions: [action], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } });
      if (url.endsWith("/actions/a1")) return response(action);
      if (init?.method === "POST") return response(action);
      return response([]);
    });
    render(<AgentAiWorkspace />);
    await waitFor(() => expect(screen.getByText("Review lead response")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Review lead response/ }));
    await waitFor(() => expect(screen.getByLabelText("Snooze until")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Snooze until"), { target: { value: "2030-01-01T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Snooze" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/ai/actions/a1/snooze", expect.objectContaining({ method: "POST" })));
    fireEvent.click(screen.getByRole("button", { name: /Review lead response/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/ai/actions/a1/dismiss", expect.objectContaining({ method: "POST" })));
  });
  it("bounds reconnects when the chat stream keeps failing", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/chat")) throw new Error("AI unavailable");
      if (url.endsWith("/conversations")) return response([]);
      return response({ actions: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } });
    });
    render(<AgentAiWorkspace />);
    await waitFor(() => expect(screen.getByText("Queue is empty")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("AI message"), { target: { value: "Try" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("AI service is unavailable"), { timeout: 3000 });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/chat"))).toHaveLength(3);
  });
});
