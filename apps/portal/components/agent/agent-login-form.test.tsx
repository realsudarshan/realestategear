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

const { AgentLoginForm } = await import("./agent-login-form");

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("AgentLoginForm", () => {
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

  it("navigates into the workspace on login success", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: { id: "u1" } }) });
    render(<AgentLoginForm googleAvailable={false} />);
    fillAndSubmit("agent@example.com", "secret12");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agent"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/agent/login");
  });

  it("shows invalid credentials and does not navigate", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid credentials" }),
    });
    render(<AgentLoginForm googleAvailable={false} />);
    fillAndSubmit("agent@example.com", "wrong");
    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("explains when the Agent API is disabled", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Agent API is disabled", code: "AGENT_API_DISABLED" }),
    });
    render(<AgentLoginForm googleAvailable={false} />);
    fillAndSubmit("agent@example.com", "secret12");
    await waitFor(() => expect(screen.getByText(/AGENT_API_ENABLED/)).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("offers Google sign-in when configuration is available", () => {
    render(<AgentLoginForm googleAvailable />);
    expect(screen.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/api/agent/google/start?return_to=%2Fagent",
    );
  });
});
