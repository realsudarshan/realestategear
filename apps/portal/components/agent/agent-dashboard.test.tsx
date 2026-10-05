// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const { AgentDashboard } = await import("./agent-dashboard");

const DASHBOARD = {
  stats: { activeContacts: 3, openTransactions: 2, pendingTasks: 1, closedThisMonth: 4 },
  recentContacts: [
    {
      id: "c1",
      firstName: "Sam",
      lastName: "Buyer",
      type: "BUYER",
      stage: "ACTIVE",
      email: "sam@example.com",
      phone: null,
      createdAt: "2026-10-01T00:00:00.000Z",
    },
  ],
  upcomingTasks: [
    {
      id: "t1",
      title: "Follow up",
      dueDate: "2026-10-07T15:00:00.000Z",
      priority: "HIGH",
      status: "TODO",
    },
  ],
};

const EMPTY = {
  stats: { activeContacts: 0, openTransactions: 0, pendingTasks: 0, closedThisMonth: 0 },
  recentContacts: [],
  upcomingTasks: [],
};

describe("AgentDashboard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a loading skeleton until the dashboard responds", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve; }));
    render(<AgentDashboard />);
    expect(screen.getByLabelText("Loading dashboard")).toBeInTheDocument();
    resolveFetch({ ok: true, status: 200, json: async () => DASHBOARD });
    await waitFor(() => expect(screen.getByText("Sam Buyer")).toBeInTheDocument());
  });

  it("renders stats, contacts, and tasks from the API payload", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => DASHBOARD });
    render(<AgentDashboard />);
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
    expect(screen.getByText("Sam Buyer")).toBeInTheDocument();
    expect(screen.getByText("Follow up")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute("href", "/agent/contacts");
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "/agent/transactions");
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute("href", "/agent/tasks");
    expect(screen.getByRole("link", { name: "Inquiries" })).toHaveAttribute("href", "/agent/inquiries");
  });

  it("shows empty states when counts and lists are zero", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => EMPTY });
    render(<AgentDashboard />);
    await waitFor(() => expect(screen.getByText("No workspace activity yet")).toBeInTheDocument());
    expect(screen.getByText("No contacts yet")).toBeInTheDocument();
    expect(screen.getByText("No upcoming tasks")).toBeInTheDocument();
  });

  it("does not render an incomplete dashboard payload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ stats: {}, recentContacts: [], upcomingTasks: [] }),
    });
    render(<AgentDashboard />);
    await waitFor(() => expect(screen.getByText("Unexpected dashboard response.")).toBeInTheDocument());
    expect(screen.queryByText("Active contacts")).not.toBeInTheDocument();
  });

  it("sends unauthorized visitors to login", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) });
    render(<AgentDashboard />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agent/login?from=/agent"));
  });

  it("explains a 403", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: "Forbidden" }) });
    render(<AgentDashboard />);
    await waitFor(() => expect(screen.getByText("You do not have permission to view this dashboard.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("explains a 404", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "Not found" }) });
    render(<AgentDashboard />);
    await waitFor(() => expect(screen.getByText("Not found")).toBeInTheDocument());
  });

  it("explains when the Agent API is disabled", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Agent API is disabled", code: "AGENT_API_DISABLED" }),
    });
    render(<AgentDashboard />);
    await waitFor(() => expect(screen.getByText(/AGENT_API_ENABLED/)).toBeInTheDocument());
  });
});
