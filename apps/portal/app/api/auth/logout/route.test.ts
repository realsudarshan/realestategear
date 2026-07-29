import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, cookieDelete } = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieDelete: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies }));

const { POST } = await import("./route");

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    cookieDelete.mockReset();
    cookies.mockResolvedValue({ delete: cookieDelete });
  });

  it("deletes the portal_token cookie and returns ok", async () => {
    const res = await POST();
    expect(cookieDelete).toHaveBeenCalledWith("portal_token");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
