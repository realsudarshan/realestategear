// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push, replace, router } = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  return { push, replace, router: { push, replace } };
});
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/agent/contacts",
  useSearchParams: () => new URLSearchParams(search),
}));

const { AgentContactsList, AgentContactDetail } = await import("./agent-contact-crm");

const contact = {
  id: "c1", firstName: "Sam", lastName: "Buyer", type: "LEAD", stage: "ACTIVE",
  email: "sam@example.com", phone: "555", company: null, source: "Referral",
  tags: ["warm"], createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
  buyerTrack: { side: "BUYER", stage: "QUALIFIED", isActive: true }, sellerTrack: null,
  user: null,
};
const list = {
  contacts: [contact],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  lifecycleCounts: { prospect: 0, activeLead: 1, client: 0, vendor: 0 },
};
const interaction = {
  id: "i1", contactId: "c1", type: "NOTE", side: null, subject: "Call",
  body: "Discussed next steps", occurredAt: "2026-10-02T00:00:00.000Z", duration: null,
  createdAt: "2026-10-02T00:00:00.000Z",
};

describe("Agent contacts CRM", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
    search = "search=Sam&sortBy=name_asc";
    push.mockReset();
    replace.mockReset();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("loads the list, preserves URL filters, and links to detail", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => list });
    render(<AgentContactsList />);
    await waitFor(() => expect(screen.getByRole("link", { name: "Sam Buyer" })).toHaveAttribute("href", "/agent/contacts/c1"));
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/contacts?search=Sam&sortBy=name_asc", expect.anything());
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Alex" } });
    expect(replace).toHaveBeenCalledWith("/agent/contacts?search=Alex&sortBy=name_asc");
  });

  it("redirects unauthorized list requests to login", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) });
    render(<AgentContactsList />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agent/login?from=%2Fagent%2Fcontacts"));
  });

  it("loads detail, creates and deletes interactions, links a portal user, and deletes contact", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...contact, user: null }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [interaction] });
    render(<AgentContactDetail id="c1" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Sam Buyer" })).toBeInTheDocument());
    expect(screen.getByText("Discussed next steps")).toBeInTheDocument();

    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => url.endsWith("/interactions") ? [interaction] : ({
        ...contact,
        user: { id: "u1", email: "sam@example.com", firstName: "Sam", lastName: "Buyer" },
      }),
    }));
    fireEvent.change(screen.getByLabelText("Portal user email"), { target: { value: "sam@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Link user" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/contacts/c1/link", expect.objectContaining({ method: "PUT" })));

    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => interaction });
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Follow up" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Sent details" } });
    fireEvent.click(screen.getByRole("button", { name: "Add interaction" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/contacts/c1/interactions", expect.objectContaining({ method: "POST" })));

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/contacts/c1", expect.objectContaining({ method: "DELETE" })));
  });
});
