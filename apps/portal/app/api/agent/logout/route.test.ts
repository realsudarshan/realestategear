import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, cookieDelete } = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieDelete: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies }));

const { POST } = await import("./route");

describe("POST /api/agent/logout", () => {
  beforeEach(() => {
    cookies.mockReset();
    cookieDelete.mockReset();
    cookies.mockResolvedValue({ delete: cookieDelete });
  });

  it("clears the agent cookie even if upstream logout fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(cookieDelete).toHaveBeenCalledWith("agent_token");
    vi.unstubAllGlobals();
  });
});
