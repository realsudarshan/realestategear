// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const { AgentRegisterForm } = await import("./agent-register-form");

describe("AgentRegisterForm", () => {
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

  it("validates required fields before calling the API", async () => {
    render(<AgentRegisterForm />);
    fireEvent.click(screen.getByRole("button", { name: "Create agent account" }));
    await waitFor(() => expect(screen.getByText("Email is required")).toBeInTheDocument());
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("First name must be at least 2 characters")).toBeInTheDocument();
    expect(screen.getByText("Account name must be at least 2 characters")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits a valid registration", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ user: { id: "u1" } }) });
    render(<AgentRegisterForm />);
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
    fireEvent.change(screen.getByLabelText("Account / company name"), { target: { value: "Ada Realty" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent account" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agent"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/agent/register");
  });
});
