import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies } = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock("next/headers", () => ({ cookies }));

const { getSessionUser } = await import("./session-user-server");

function fakeCookieStore(token: string | undefined) {
  return { get: () => (token === undefined ? undefined : { value: token }) };
}

/** Builds a JWT-shaped string (base64url payload, no real signature) — the
 * function under test only decodes the payload, it never verifies it. */
function makeToken(claims: unknown): string {
  const b64url = (s: string) =>
    Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const header = b64url(JSON.stringify({ alg: "none" }));
  const payload = b64url(JSON.stringify(claims));
  return `${header}.${payload}.signature`;
}

const fullClaims = {
  id: "u1",
  email: "jane@example.com",
  accountId: "a1",
  firstName: "Jane",
  lastName: "Doe",
  role: "USER",
  portalId: "p1",
  avatarUrl: "https://example.com/a.png",
};

describe("getSessionUser", () => {
  beforeEach(() => {
    cookies.mockReset();
  });

  it("returns null when there is no cookie", async () => {
    cookies.mockResolvedValue(fakeCookieStore(undefined));
    expect(await getSessionUser()).toBeNull();
  });

  it("returns null for a malformed token (not 3 dot-separated parts)", async () => {
    cookies.mockResolvedValue(fakeCookieStore("not-a-jwt"));
    expect(await getSessionUser()).toBeNull();
  });

  it("returns null when the payload isn't valid JSON", async () => {
    cookies.mockResolvedValue(fakeCookieStore("aGVhZGVy.not-json.sig"));
    expect(await getSessionUser()).toBeNull();
  });

  it("returns null when required claims (id/email/accountId) are missing", async () => {
    cookies.mockResolvedValue(fakeCookieStore(makeToken({ email: "jane@example.com" })));
    expect(await getSessionUser()).toBeNull();
  });

  it("returns the full user object when all claims are present", async () => {
    cookies.mockResolvedValue(fakeCookieStore(makeToken(fullClaims)));
    expect(await getSessionUser()).toEqual(fullClaims);
  });

  it("defaults optional claims when the token omits them", async () => {
    cookies.mockResolvedValue(
      fakeCookieStore(makeToken({ id: "u1", email: "jane@example.com", accountId: "a1" })),
    );
    expect(await getSessionUser()).toEqual({
      id: "u1",
      email: "jane@example.com",
      accountId: "a1",
      firstName: null,
      lastName: null,
      role: "USER",
      portalId: null,
      avatarUrl: null,
    });
  });
});
