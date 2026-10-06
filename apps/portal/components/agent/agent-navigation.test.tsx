// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentNavigation } from "./agent-navigation";

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/agent/contacts",
  useSearchParams: () => new URLSearchParams("page=2"),
  useRouter: () => router,
}));

const user = { id: "u1", email: "agent@example.com", firstName: "A", lastName: "Agent", avatarUrl: null, role: "AGENT" };
describe("Agent navigation", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); router.push.mockClear(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("renders sections and highlights the active route", () => {
    render(<AgentNavigation user={user} />);
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(screen.getByText("Contacts")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Market Reports")).toBeInTheDocument();
  });
  it("opens command palette with keyboard shortcut and links search results", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ contacts: { items: [{ id: "c1", fullName: "Alex Agent" }], total: 1 }, transactions: { items: [], total: 0 }, properties: { items: [], total: 0 }, tasks: { items: [], total: 0 } }) });
    render(<AgentNavigation user={user} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByLabelText("Command palette search"), { target: { value: "Alex" } });
    await waitFor(() => expect(screen.getByText("Alex Agent")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/search?q=Alex&limit=8", { cache: "no-store" });
    fireEvent.click(screen.getByRole("button", { name: "Alex Agent" }));
    expect(router.push).toHaveBeenCalledWith("/agent/contacts/c1?page=2");
  });
  it("supports mobile navigation toggle and escape close", () => {
    render(<AgentNavigation user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Agent navigation" }));
    expect(screen.getByRole("navigation", { name: "Agent sections" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Open Agent navigation" })).toHaveAttribute("aria-expanded", "false");
  });
});
