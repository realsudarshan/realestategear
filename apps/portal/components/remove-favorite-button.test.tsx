// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { RemoveFavoriteButton } = await import("./remove-favorite-button");

describe("RemoveFavoriteButton", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refresh.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("deletes the correct listing and refreshes on success", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    render(<RemoveFavoriteButton listingId="listing-123" />);

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/proxy/users/favorites/listing-123", { method: "DELETE" });
    expect(screen.queryByText(/Couldn.t remove/)).not.toBeInTheDocument();
  });

  it("shows an inline error and does not refresh when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<RemoveFavoriteButton listingId="listing-123" />);

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.getByText(/Couldn.t remove/)).toBeInTheDocument());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows an inline error when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<RemoveFavoriteButton listingId="listing-123" />);

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.getByText(/Couldn.t remove/)).toBeInTheDocument());
  });
});
