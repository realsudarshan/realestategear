import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, cookieSet } = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieSet: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies }));

const { establishSessionResponse } = await import("./establish-session");

function upstreamResponse(body: unknown, { ok = true, status = 200 } = {}): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
    headers: { get: () => "application/json" },
  } as unknown as Response;
}

describe("establishSessionResponse", () => {
  beforeEach(() => {
    cookies.mockReset();
    cookieSet.mockReset();
    cookies.mockResolvedValue({ set: cookieSet });
  });

  it("sets the httpOnly cookie and strips the token from the response body", async () => {
    const res = await establishSessionResponse(
      upstreamResponse({ token: "abc.def.ghi", message: "ok", user: { id: "u1" } }),
    );

    expect(cookieSet).toHaveBeenCalledTimes(1);
    expect(cookieSet.mock.calls[0][0]).toMatchObject({ name: "portal_token", value: "abc.def.ghi" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ message: "ok", user: { id: "u1" } });
    expect(body.token).toBeUndefined();
  });

  it("does not set a cookie or touch the body for a non-ok upstream response", async () => {
    const res = await establishSessionResponse(upstreamResponse({ error: "Invalid credentials" }, { ok: false, status: 401 }));

    expect(cookieSet).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
  });

  it("relays the body verbatim if an ok response doesn't have a token field", async () => {
    const res = await establishSessionResponse(upstreamResponse({ message: "no token here" }));

    expect(cookieSet).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ message: "no token here" });
  });

  it("falls back to a verbatim relay if the ok body isn't valid JSON", async () => {
    const upstream = {
      ok: true,
      status: 200,
      text: async () => "not json",
      headers: { get: () => "text/plain" },
    } as unknown as Response;

    const res = await establishSessionResponse(upstream);

    expect(cookieSet).not.toHaveBeenCalled();
    expect(await res.text()).toBe("not json");
  });
});
