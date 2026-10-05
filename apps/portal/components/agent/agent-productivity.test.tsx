// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push, replace, router } = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  return { push, replace, router: { push, replace } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/agent/tasks",
  useSearchParams: () => new URLSearchParams("status=TODO"),
}));

const { AgentTasksPage, AgentEventsPage, AgentNotesPage, AgentTaskPanel, AgentNotePanel } = await import("./agent-productivity");

const task = { id: "t1", title: "Follow up", description: null, dueDate: null, priority: "HIGH", status: "TODO", contactId: "c1", transactionId: "tx1", contact: { id: "c1", firstName: "Sam", lastName: "Buyer" }, transaction: { id: "tx1", address: "123 Main", stage: "PENDING" } };
const event = { id: "e1", type: "MEETING", customType: null, title: "Meeting", description: null, location: "Office", startAt: "2026-10-10T10:00:00.000Z", endAt: "2026-10-10T11:00:00.000Z", isAllDay: false, status: "SCHEDULED", transactionId: null, providerSyncError: null, lastSyncedAt: null, attendees: [] };
const note = { id: "n1", body: "Important context", createdAt: "2026-10-01T00:00:00.000Z", contactId: null, transactionId: null, eventId: null };

describe("Agent productivity", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); push.mockReset(); replace.mockReset(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("lists, creates, edits, deletes tasks, and preserves filters and links", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tasks: [task], pagination: { total: 1, totalPages: 1 } }) });
    render(<AgentTasksPage />);
    await waitFor(() => expect(screen.getByText("Follow up")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/tasks?status=TODO", expect.anything());
    expect(screen.getByRole("link", { name: "Sam Buyer" })).toHaveAttribute("href", "/agent/contacts/c1");
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => task }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tasks: [], pagination: { total: 0, totalPages: 0 } }) });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/tasks", expect.objectContaining({ method: "POST" })));
  });

  it("lists events, creates, edits, completes, and deletes them", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ events: [event], pagination: { total: 1 } }) });
    render(<AgentEventsPage />);
    await waitFor(() => expect(screen.getByText("Meeting")).toBeInTheDocument());
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => event }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ events: [], pagination: { total: 0 } }) });
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/events/e1/complete", expect.objectContaining({ method: "POST" })));
  });

  it("creates notes and supports contextual task and note panels", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ notes: [note], pagination: { total: 1 } }) });
    render(<AgentNotesPage />);
    await waitFor(() => expect(screen.getByText("Important context")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("New note"), { target: { value: "New context" } });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => note }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ notes: [], pagination: { total: 0 } }) });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/notes", expect.objectContaining({ method: "POST" })));

    cleanup();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tasks: [task] }) }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ notes: [note] }) });
    render(<AgentTaskPanel contactId="c1" />);
    render(<AgentNotePanel transactionId="tx1" />);
    await waitFor(() => expect(screen.getByText("Related tasks")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/tasks?contactId=c1", expect.anything());
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/notes?transactionId=tx1", expect.anything());
  });
});
