// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const documentSlot = {
  id: "d1",
  label: "Purchase Agreement",
  status: "MISSING",
  documentDefinition: { key: "purchase_agreement", label: "Purchase Agreement", required: true, sortOrder: 1 },
  matchedAttachment: null,
  driveWebLink: null,
};
const attachment = {
  id: "a1",
  filename: "agreement.pdf",
  mimeType: "application/pdf",
  sizeBytes: 100,
  suggestedDocType: "CONTRACT",
  suggestedConfidence: 0.9,
  isMatched: false,
  message: { id: "m1", subject: "Agreement", sentAt: "2026-10-01T00:00:00.000Z" },
};

const { AgentTransactionDocuments } = await import("./agent-transaction-documents");

describe("Agent transaction documents and email sync", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  function seed() {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [documentSlot] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ attachments: [attachment] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
  }

  it("loads pending documents and transitions them through matched, verified, and synchronized", async () => {
    let status = "MISSING";
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/match")) status = "MATCHED";
      if (url.endsWith("/verify")) status = "VERIFIED";
      if (url.endsWith("/copy-to-drive")) return { ok: true, status: 200, json: async () => ({ ...documentSlot, status, matchedAttachment: attachment, driveWebLink: "https://drive.google.com/file/d1" }) };
      if (url.endsWith("/documents")) return { ok: true, status: 200, json: async () => [{ ...documentSlot, status, matchedAttachment: status === "MISSING" ? null : attachment }] };
      if (url.endsWith("/attachments")) return { ok: true, status: 200, json: async () => ({ attachments: [{ ...attachment, isMatched: status !== "MISSING" }] }) };
      return { ok: true, status: 200, json: async () => [] };
    });
    render(<AgentTransactionDocuments transactionId="t1" />);
    await waitFor(() => expect(screen.getByText("Pending")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Match agreement.pdf" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Match agreement.pdf" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/t1/documents/d1/match", expect.objectContaining({ method: "PATCH" })));

    await waitFor(() => expect(screen.getByRole("button", { name: "Verify" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/t1/documents/d1/verify", expect.objectContaining({ method: "PATCH" })));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copy to Drive" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Copy to Drive" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/t1/documents/d1/copy-to-drive", expect.objectContaining({ method: "POST" })));
  });

  it("adds and deletes custom document slots", async () => {
    seed();
    render(<AgentTransactionDocuments transactionId="t1" />);
    await waitFor(() => expect(screen.getByText("Pending")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Custom document label"), { target: { value: "Inspection addendum" } });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: "d2" }) });
    fireEvent.click(screen.getByRole("button", { name: "Add document slot" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/t1/documents", expect.objectContaining({ method: "POST" })));
  });

  it("starts synchronization and confirms or rejects discovered messages", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ attachments: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: "m1", status: "PENDING", subject: "Offer", attachments: [], sentAt: null, fromEmail: null, fromName: null, snippet: null, category: "OFFER", confidence: 0.9 }] });
    render(<AgentTransactionDocuments transactionId="t1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument());
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "m1", status: "CONFIRMED" }) });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/t1/discovered-messages/m1/confirm", expect.objectContaining({ method: "POST" })));

    cleanup();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ attachments: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: "m2", status: "PENDING", subject: "Noise", attachments: [], sentAt: null, fromEmail: null, fromName: null, snippet: null, category: "NOISE", confidence: 0.9 }] });
    render(<AgentTransactionDocuments transactionId="t1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument());
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "m2", status: "DISMISSED" }) });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/t1/discovered-messages/m2/dismiss", expect.objectContaining({ method: "POST" })));

    cleanup();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    seed();
    render(<AgentTransactionDocuments transactionId="t1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Sync Gmail" })).toBeInTheDocument());
    fetchMock.mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ syncRunId: "r1" }) });
    fireEvent.click(screen.getByRole("button", { name: "Sync Gmail" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/t1/sync", expect.objectContaining({ method: "POST" })));
  });

  it("shows failed synchronization status and retryable errors", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ attachments: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: "r1", status: "FAILED", messagesFound: 0, error: "Gmail unavailable", startedAt: "2026-10-01T00:00:00.000Z", completedAt: null, query: null }] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: "m1", status: "DISMISSED", subject: "Rejected", attachments: [], sentAt: null, fromEmail: null, fromName: null, snippet: null, category: null, confidence: null }] });
    render(<AgentTransactionDocuments transactionId="t1" />);
    await waitFor(() => expect(screen.getAllByText("Failed").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
  });
});
