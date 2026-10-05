import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, cookieSet } = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieSet: vi.fn(),
}));
const redirect = vi.hoisted(() => vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }));

vi.mock("next/headers", () => ({ cookies }));
vi.mock("next/navigation", () => ({ redirect }));

const { completeAgentGoogleCallback, establishAgentSessionFromToken } = await import("./agent-oauth");

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

describe("completeAgentGoogleCallback", () => {
  beforeEach(() => {
    cookies.mockReset();
    cookieSet.mockReset();
    redirect.mockClear();
    cookies.mockResolvedValue({ set: cookieSet });
  });

  it("sets the httpOnly cookie and sends agents into the workspace", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { user: AGENT_USER })));
    await expect(
      completeAgentGoogleCallback({ oauth: "google", token: "jwt.here", redirect: "/agent/settings" }),
    ).rejects.toThrow("REDIRECT:/agent/settings");
    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({
      name: "agent_token",
      value: "jwt.here",
      httpOnly: true,
    }));
  });

  it("leaves portal-consumer tokens on /login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { user: { ...AGENT_USER, role: "USER" } })));
    await expect(
      completeAgentGoogleCallback({ oauth: "google", token: "consumer.jwt", redirect: "/favorites" }),
    ).resolves.toBeUndefined();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends agent_not_found to the agent login page", async () => {
    await expect(
      completeAgentGoogleCallback({ google_error: "agent_not_found" }),
    ).rejects.toThrow("REDIRECT:/agent/login?google_error=agent_not_found");
  });

  it("does not steal generic Google errors from portal login", async () => {
    await expect(completeAgentGoogleCallback({ google_error: "missing_code" })).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("establishAgentSessionFromToken", () => {
  beforeEach(() => {
    cookies.mockReset();
    cookieSet.mockReset();
    cookies.mockResolvedValue({ set: cookieSet });
  });

  it("rejects a disabled Agent API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(404, { error: "Agent API is disabled", code: "AGENT_API_DISABLED" })),
    );
    await expect(establishAgentSessionFromToken("jwt")).resolves.toEqual({
      ok: false,
      error: "Agent API is disabled",
      status: 404,
    });
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
