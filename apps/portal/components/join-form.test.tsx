// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push, refresh, searchParamsGet } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  searchParamsGet: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

const { JoinForm } = await import("./join-form");

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "somepassword1" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("JoinForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    searchParamsGet.mockReset();
    searchParamsGet.mockReturnValue(null);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the server error (e.g. duplicate email) and does not navigate", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Email already registered on this portal" }),
    });
    render(<JoinForm />);

    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText("Email already registered on this portal")).toBeInTheDocument(),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("submits optional first/last name alongside required fields", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: "u1" } }) });
    render(<JoinForm />);

    fireEvent.change(screen.getByLabelText("First name (optional)"), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText("Last name (optional)"), { target: { value: "Doe" } });
    fillAndSubmit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    const registerBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(registerBody).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      password: "somepassword1",
    });
  });

  it("auto-logs-in (navigates) on full success — the route sets the session cookie itself", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: "u1" } }) });
    render(<JoinForm />);

    fillAndSubmit();

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/register");
  });

  it("respects ?from= after a successful join", async () => {
    searchParamsGet.mockReturnValue("/favorites");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: "u1" } }) });
    render(<JoinForm />);

    fillAndSubmit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/favorites"));
  });

  it("shows a connection error when the request throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    render(<JoinForm />);

    fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Unable to connect to server")).toBeInTheDocument());
  });
});
