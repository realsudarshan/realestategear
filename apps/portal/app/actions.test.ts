import { beforeEach, describe, expect, it, vi } from "vitest";

const { headers } = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock("next/headers", () => ({ headers }));

const { submitInquiry } = await import("./actions");

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("submitInquiry", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    headers.mockReset();
    headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.5" }));
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  // Regression: an adversarial review found the API's per-visitor inquiry
  // rate limit (5/hour, keyed on IP:slug) collapsed into one shared bucket
  // for the whole portal, because this call never forwarded the visitor's
  // IP — every submission looked like it came from this server's own
  // container IP. Any one visitor could exhaust the site's only lead-
  // capture path for everyone.
  it("forwards the visitor's IP so the backend rate limit is keyed per-visitor, not per-server", async () => {
    await submitInquiry(null, formData({ name: "Jane", email: "jane@example.com" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Forwarded-For"]).toBe("203.0.113.5");
  });

  it("returns a validation error and never calls fetch for an invalid email", async () => {
    const result = await submitInquiry(null, formData({ name: "Jane", email: "not-an-email" }));
    expect(result).toEqual({ ok: false, error: "Enter a valid email" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays the upstream error message on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Portal not accepting inquiries" }) });
    const result = await submitInquiry(null, formData({ name: "Jane", email: "jane@example.com" }));
    expect(result).toEqual({ ok: false, error: "Portal not accepting inquiries" });
  });

  it("returns a connection error when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const result = await submitInquiry(null, formData({ name: "Jane", email: "jane@example.com" }));
    expect(result).toEqual({ ok: false, error: "Unable to reach the server. Please try again." });
  });
});
