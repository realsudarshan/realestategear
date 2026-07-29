import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { cookies, cookieSet } = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieSet: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies }));

const { POST } = await import("./route");

function fakeRequestThatFailsToReadBody(): NextRequest {
  return {
    text: () => Promise.reject(new Error("stream error")),
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    cookies.mockReset();
    cookieSet.mockReset();
    cookies.mockResolvedValue({ set: cookieSet });
  });

  it("returns 400 when the request body can't be read", async () => {
    const res = await POST(fakeRequestThatFailsToReadBody());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid body" });
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("proxies to the portal-scoped login endpoint, sets the session cookie, and strips the token from the client-facing body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: "abc.def.ghi", user: { id: "u1" } }),
      headers: { get: () => "application/json" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "jane@example.com", password: "pw" }),
    });
    const res = await POST(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/portals/example-realty/auth/login");
    expect(init.method).toBe("POST");

    expect(cookieSet).toHaveBeenCalledTimes(1);
    expect(cookieSet.mock.calls[0][0]).toMatchObject({
      name: "portal_token",
      value: "abc.def.ghi",
      httpOnly: true,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ user: { id: "u1" } });
    expect(body.token).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("relays a non-ok upstream response verbatim and never sets a cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "Invalid credentials" }),
      headers: { get: () => "application/json" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "jane@example.com", password: "wrong" }),
    });
    const res = await POST(request);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
    expect(cookieSet).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
