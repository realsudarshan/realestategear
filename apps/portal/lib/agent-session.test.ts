import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, cookieSet, cookieGet, cookieDelete } = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieSet: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies }));

const { loadAgentSession, refreshAgentAccessToken, fetchAgentMe } = await import("./agent-session");

const AGENT_USER = {
  id: "u1",
  email: "agent@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  role: "AGENT",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("loadAgentSession", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cookies.mockReset();
    cookieSet.mockReset();
    cookieGet.mockReset();
    cookieDelete.mockReset();
    cookies.mockResolvedValue({ set: cookieSet, get: cookieGet, delete: cookieDelete });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns unauthenticated when there is no cookie", async () => {
    cookieGet.mockReturnValue(undefined);
    await expect(loadAgentSession()).resolves.toEqual({ status: "unauthenticated" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the current user through /api/auth/me", async () => {
    cookieGet.mockReturnValue({ value: "live-token" });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: AGENT_USER }));
    await expect(loadAgentSession()).resolves.toEqual({ status: "ok", user: AGENT_USER });
    expect(fetchMock.mock.calls[0][0]).toContain("/api/auth/me");
  });

  it("refreshes an expired token then restores the session", async () => {
    cookieGet.mockReturnValue({ value: "expired-token" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: "Token expired" }))
      .mockResolvedValueOnce(jsonResponse(200, { token: "next-token" }))
      .mockResolvedValueOnce(jsonResponse(200, { user: AGENT_USER }));

    await expect(loadAgentSession()).resolves.toEqual({ status: "ok", user: AGENT_USER });
    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({ name: "agent_token", value: "next-token", httpOnly: true }));
    expect(fetchMock.mock.calls[1][0]).toContain("/api/auth/refresh");
  });

  it("clears the cookie when refresh of an expired token fails", async () => {
    cookieGet.mockReturnValue({ value: "expired-token" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: "Token expired" }))
      .mockResolvedValueOnce(jsonResponse(401, { error: "Invalid token" }));

    await expect(loadAgentSession()).resolves.toEqual({ status: "unauthenticated", reason: "expired" });
    expect(cookieDelete).toHaveBeenCalledWith("agent_token");
  });

  it("reports the disabled Agent API", async () => {
    cookieGet.mockReturnValue({ value: "live-token" });
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: "Agent API is disabled", code: "AGENT_API_DISABLED" }));
    await expect(loadAgentSession()).resolves.toEqual({ status: "disabled" });
  });
});

describe("refreshAgentAccessToken", () => {
  beforeEach(() => {
    cookies.mockReset();
    cookieSet.mockReset();
    cookies.mockResolvedValue({ set: cookieSet, get: vi.fn(), delete: vi.fn() });
  });

  it("returns null when refresh is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    await expect(refreshAgentAccessToken("stale")).resolves.toBeNull();
  });
});

describe("fetchAgentMe", () => {
  it("sends the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await fetchAgentMe("abc");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/auth/me"), expect.objectContaining({
      headers: { Authorization: "Bearer abc" },
    }));
  });
});
