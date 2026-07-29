import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookies } = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock("next/headers", () => ({ cookies }));

const { getToken, tokenCookieOptions, TOKEN_COOKIE_NAME } = await import("./auth");

describe("TOKEN_COOKIE_NAME", () => {
  it("is portal_token", () => {
    expect(TOKEN_COOKIE_NAME).toBe("portal_token");
  });
});

describe("getToken", () => {
  beforeEach(() => {
    cookies.mockReset();
  });

  it("returns the cookie value when present", async () => {
    cookies.mockResolvedValue({ get: () => ({ value: "abc.def.ghi" }) });
    expect(await getToken()).toBe("abc.def.ghi");
  });

  it("returns undefined when the cookie is absent", async () => {
    cookies.mockResolvedValue({ get: () => undefined });
    expect(await getToken()).toBeUndefined();
  });
});

describe("tokenCookieOptions", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
  });

  it("marks the cookie httpOnly with the right name/value/path", () => {
    const options = tokenCookieOptions("abc.def.ghi");
    expect(options).toMatchObject({
      name: "portal_token",
      value: "abc.def.ghi",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  });

  it("sets secure=false outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(tokenCookieOptions("t").secure).toBe(false);
  });

  it("sets secure=true in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(tokenCookieOptions("t").secure).toBe(true);
  });
});
