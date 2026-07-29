// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/session-user";

const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/session-user-server", () => ({ getSessionUser }));
// Isolate this test to site-header's own nav logic — logout-button.test.tsx
// and mobile-nav.test.tsx cover those components' own behavior in depth.
vi.mock("@/components/logout-button", () => ({ LogoutButton: () => <button>Log out</button> }));
vi.mock("@/components/mobile-nav", () => ({
  MobileNav: ({ isAuthed }: { isAuthed: boolean }) => (
    <div data-testid="mobile-nav" data-authed={isAuthed} />
  ),
}));

const { SiteHeader } = await import("./site-header");

const user: SessionUser = {
  id: "u1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  role: "USER",
  accountId: "a1",
  portalId: "p1",
  avatarUrl: null,
};

describe("SiteHeader", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows Log in (no separate Join link) when there is no session", async () => {
    getSessionUser.mockResolvedValue(null);
    render(await SiteHeader());

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: "Join" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Favorites" })).not.toBeInTheDocument();
    expect(screen.queryByText("Log out")).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav")).toHaveAttribute("data-authed", "false");
  });

  it("shows Favorites / Log out when there is a session", async () => {
    getSessionUser.mockResolvedValue(user);
    render(await SiteHeader());

    expect(screen.getByRole("link", { name: "Favorites" })).toHaveAttribute("href", "/favorites");
    expect(screen.getByText("Log out")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav")).toHaveAttribute("data-authed", "true");
  });

  it("renders a Properties nav link pointing at /properties", async () => {
    getSessionUser.mockResolvedValue(null);
    render(await SiteHeader());

    expect(screen.getByRole("link", { name: "Properties" })).toHaveAttribute("href", "/properties");
  });

  it("links Communities/Contact/Talk to an agent to real routes, not homepage-only anchors", async () => {
    // Regression: these were bare `#communities`/`#inquiry` anchors, which only
    // worked when already on `/` — clicking them from any other page (e.g. the
    // new /properties page) resolved to `<currentPath>#communities`, a dead
    // link. Found by manual testing on 2026-07-20.
    getSessionUser.mockResolvedValue(null);
    render(await SiteHeader());

    expect(screen.getByRole("link", { name: "Communities" })).toHaveAttribute("href", "/communities");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "Talk to an agent" })).toHaveAttribute("href", "/contact");
  });
});
