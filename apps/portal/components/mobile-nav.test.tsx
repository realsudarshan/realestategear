// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/logout-button", () => ({
  LogoutButton: ({ mobile }: { mobile?: boolean }) => <button>Log out{mobile ? " (mobile)" : ""}</button>,
}));

const { MobileNav } = await import("./mobile-nav");

afterEach(() => cleanup());

describe("MobileNav", () => {
  it("opens the sheet and shows Log in (no separate Join link) when logged out", () => {
    render(<MobileNav isAuthed={false} />);

    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: "Join" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Favorites" })).not.toBeInTheDocument();
    // Regression: these were bare `#communities`/`#inquiry` anchors, only
    // correct when already on `/` — broken from any other page. Found by
    // manual testing on 2026-07-20.
    expect(screen.getByRole("link", { name: "Communities" })).toHaveAttribute("href", "/communities");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "Properties" })).toHaveAttribute("href", "/properties");
    expect(screen.getByRole("link", { name: "Talk to an agent" })).toHaveAttribute("href", "/contact");
  });

  it("shows Favorites and Log out when logged in, not Log in", () => {
    render(<MobileNav isAuthed />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    expect(screen.getByRole("link", { name: "Favorites" })).toHaveAttribute("href", "/favorites");
    expect(screen.getByText("Log out (mobile)")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });
});
