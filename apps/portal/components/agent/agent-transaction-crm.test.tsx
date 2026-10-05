// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push, replace, router } = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  return { push, replace, router: { push, replace } };
});
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/agent/transactions",
  useSearchParams: () => new URLSearchParams(search),
}));

const {
  AgentTransactionsList,
  AgentTransactionPipeline,
  AgentTransactionCreate,
  AgentTransactionDetail,
} = await import("./agent-transaction-crm");

const transaction = {
  id: "t1",
  type: "BUY",
  stage: "PENDING",
  address: "123 Main St",
  mlsId: null,
  listPrice: 450000,
  salePrice: null,
  commissionRate: 2.5,
  closingDate: "2026-11-01T00:00:00.000Z",
  notes: "First-time buyer",
  parties: [{ contactId: "c1", role: "BUYER", contact: { id: "c1", firstName: "Sam", lastName: "Buyer" } }],
  milestones: [],
  tasks: [],
};
const list = { transactions: [transaction], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } };
const template = {
  key: "standard-transaction-v1",
  name: "Standard",
  description: "Plan",
  milestones: [
    { key: "offer_accepted", label: "Offer Accepted", required: true, sortOrder: 1 },
    { key: "inspection_deadline", label: "Inspection Deadline", required: true, sortOrder: 2 },
    { key: "appraisal_date", label: "Appraisal Date", required: true, sortOrder: 3 },
    { key: "financing_deadline", label: "Financing Deadline", required: true, sortOrder: 4 },
    { key: "closing_date", label: "Closing Date", required: true, sortOrder: 5 },
  ],
};

describe("Agent transaction CRM", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
    search = "stage=PENDING";
    push.mockReset();
    replace.mockReset();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("renders the filtered transaction list and pipeline cards", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => list });
    render(<AgentTransactionsList />);
    await waitFor(() => expect(screen.getByRole("link", { name: "123 Main St" })).toHaveAttribute("href", "/agent/transactions/t1"));
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions?stage=PENDING", expect.anything());

    cleanup();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ PROSPECT: [], SIGNED: [], LISTED: [], PENDING: [transaction], CLOSED: [] }) });
    render(<AgentTransactionPipeline />);
    await waitFor(() => expect(screen.getByText("123 Main St")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "PENDING" })).toBeInTheDocument();
  });

  it("previews and creates a milestone transaction", async () => {
    search = "mode=milestones";
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => template });
    render(<AgentTransactionCreate />);
    await waitFor(() => expect(screen.getByText("Offer Accepted")).toBeInTheDocument());
    const dates = ["2026-10-01", "2026-10-05", "2026-10-10", "2026-10-15", "2026-11-01"];
    for (const [index, value] of dates.entries()) {
      fireEvent.change(screen.getByLabelText(template.milestones[index].label), { target: { value } });
    }
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ validation: { requiredMissing: [] }, preview: { timeline: [] } }) });
    fireEvent.click(screen.getByRole("button", { name: "Preview plan" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/preview", expect.objectContaining({ method: "POST" })));
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: "t2" }) });
    fireEvent.click(screen.getByRole("button", { name: "Create transaction and plan" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/create-from-milestones", expect.objectContaining({ method: "POST" })));
  });

  it("loads detail, edits, manages parties, and deletes a transaction", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => transaction })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ contacts: [{ id: "c2", firstName: "Alex", lastName: "Seller" }] }) });
    render(<AgentTransactionDetail id="t1" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "123 Main St" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => transaction });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/t1", expect.objectContaining({ method: "PUT" })));

    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => url.endsWith("/contacts?limit=100") ? { contacts: [{ id: "c2", firstName: "Alex", lastName: "Seller" }] } : transaction,
    }));
    fireEvent.change(screen.getByRole("combobox", { name: "Contact" }), { target: { value: "c2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/t1/parties", expect.objectContaining({ method: "POST" })));

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agent/transactions/t1", expect.objectContaining({ method: "DELETE" })));
  });
});
