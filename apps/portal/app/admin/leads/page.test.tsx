import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }));
const getToken = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth", () => ({ getToken, TOKEN_COOKIE_NAME: "portal_token" }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));

describe("owner leads page authorization", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

  it("redirects without a session", async () => {
    getToken.mockResolvedValue(null);
    const { default: Page } = await import("./page");
    await expect(Page()).rejects.toThrow("REDIRECT:/login?from=/admin/leads");
  });

  it("checks the owner API and redirects a non-owner despite a cookie", async () => {
    getToken.mockResolvedValue("signed-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "Owner membership required" }), { status: 403 }));
    const { default: Page } = await import("./page");
    await expect(Page()).rejects.toThrow("REDIRECT:/login?from=/admin/leads");
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/owner/leads?portalSlug="), expect.objectContaining({ headers: { Authorization: "Bearer signed-token" } }));
  });

  it("surfaces upstream availability errors instead of treating them as authorization", async () => {
    getToken.mockResolvedValue("signed-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 500 }));
    const { default: Page } = await import("./page");
    await expect(Page()).rejects.toThrow("Owner leads request failed: 500");
  });
});
