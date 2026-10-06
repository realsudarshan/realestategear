// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentMlsVerificationPage } from "./agent-mls-verification";

describe("Agent MLS verification", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("renders a verified board and membership", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ verified: true, mlsBoardId: "board-1", mlsBoardName: "Example MLS", membershipId: "A-123", verifiedAt: "2026-01-01T00:00:00.000Z" }) });
    render(<AgentMlsVerificationPage />);
    await waitFor(() => expect(screen.getByText("Example MLS")).toBeInTheDocument());
    expect(screen.getByText("A-123")).toBeInTheDocument();
    expect(screen.getByText(/does not automatically enable public MLS display/i)).toBeInTheDocument();
  });

  it("shows unverified and handles an invalid submission locally", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ verified: false }) });
    render(<AgentMlsVerificationPage />);
    await waitFor(() => expect(screen.getByText("Not verified")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Verify membership" }));
    expect(screen.getByText("Enter a valid MLS membership ID.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows failed verification and supports successful verification", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ verified: false }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "not_found" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "verified" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ verified: true, mlsBoardId: "b", mlsBoardName: "Board", membershipId: "A", verifiedAt: "2026-01-01" }) });
    render(<AgentMlsVerificationPage />);
    await waitFor(() => expect(screen.getByText("Not verified")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("MLS membership ID"), { target: { value: "A-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify membership" }));
    await waitFor(() => expect(screen.getByText(/not found in the synchronized/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Verify membership" }));
    await waitFor(() => expect(screen.getByText("Board")).toBeInTheDocument());
  });

  it("distinguishes API failure and disabled configuration", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "MLS request failed." }) });
    render(<AgentMlsVerificationPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("MLS request failed."));
    cleanup();
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "MLS_BOARD_ID is not set." }) });
    render(<AgentMlsVerificationPage />);
    await waitFor(() => expect(screen.getByText("MLS verification unavailable")).toBeInTheDocument());
    expect(screen.getByText(/no MLS board configured/i)).toBeInTheDocument();
  });
});
