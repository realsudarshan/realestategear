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

const { LoginForm } = await import("./login-form");

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginForm", () => {
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

  it("shows the server error and does not navigate on invalid credentials", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Invalid credentials" }) });
    render(<LoginForm />);

    fillAndSubmit("jane@example.com", "wrongpassword");

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("navigates to / by default on success — the route sets the session cookie itself", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: "u1" } }) });
    render(<LoginForm />);

    fillAndSubmit("jane@example.com", "correctpassword");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(refresh).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/login");
  });

  it("respects a same-origin ?from= redirect target", async () => {
    searchParamsGet.mockReturnValue("/favorites");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: "u1" } }) });
    render(<LoginForm />);

    fillAndSubmit("jane@example.com", "correctpassword");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/favorites"));
  });

  it("ignores an open-redirect ?from= and falls back to /", async () => {
    searchParamsGet.mockReturnValue("//evil.com");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: "u1" } }) });
    render(<LoginForm />);

    fillAndSubmit("jane@example.com", "correctpassword");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("shows a connection error when the request throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    render(<LoginForm />);

    fillAndSubmit("jane@example.com", "correctpassword");

    await waitFor(() => expect(screen.getByText("Unable to connect to server")).toBeInTheDocument());
  });
});
