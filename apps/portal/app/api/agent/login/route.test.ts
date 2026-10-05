import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { cookies, cookieSet } = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieSet: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies }));

const { POST } = await import("./route");

describe("POST /api/agent/login", () => {
  beforeEach(() => {
    cookies.mockReset();
    cookieSet.mockReset();
    cookies.mockResolvedValue({ set: cookieSet });
  });

  it("sets the httpOnly agent cookie and strips the token on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: "jwt.here", user: { id: "u1", role: "AGENT" } }),
      headers: { get: () => "application/json" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      new NextRequest("http://localhost/api/agent/login", {
        method: "POST",
        body: JSON.stringify({ email: "agent@example.com", password: "secret12" }),
      }),
    );

    expect(fetchMock.mock.calls[0][0]).toContain("/api/auth/login");
    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({
      name: "agent_token",
      value: "jwt.here",
      httpOnly: true,
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: "u1", role: "AGENT" } });
    vi.unstubAllGlobals();
  });

  it("relays invalid credentials without setting a cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "Invalid credentials" }),
      headers: { get: () => "application/json" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      new NextRequest("http://localhost/api/agent/login", {
        method: "POST",
        body: JSON.stringify({ email: "agent@example.com", password: "wrong" }),
      }),
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
    expect(cookieSet).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("relays AGENT_API_DISABLED without setting a cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: "Agent API is disabled", code: "AGENT_API_DISABLED" }),
      headers: { get: () => "application/json" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      new NextRequest("http://localhost/api/agent/login", {
        method: "POST",
        body: JSON.stringify({ email: "agent@example.com", password: "secret12" }),
      }),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Agent API is disabled", code: "AGENT_API_DISABLED" });
    expect(cookieSet).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
