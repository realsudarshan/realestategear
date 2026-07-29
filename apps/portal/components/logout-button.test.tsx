// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const { LogoutButton } = await import("./logout-button");

describe("LogoutButton", () => {
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

  it("logs out and navigates home when the request succeeds", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
  });

  it("shows a retry message and does not navigate when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(screen.getByText("Try again")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a retry message and does not navigate when the request throws (network failure)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(screen.getByText("Try again")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("renders as a full-width mobile item when mobile is set, and still works", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<LogoutButton mobile />);

    const button = screen.getByRole("button", { name: "Log out" });
    expect(button.className).toContain("w-full");

    fireEvent.click(button);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});
