import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }));
const loadAgentSession = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/agent-session", () => ({ loadAgentSession }));

describe("Agent auth layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects authenticated agents away from login and register", async () => {
    loadAgentSession.mockResolvedValue({
      status: "ok",
      user: { id: "u1", email: "a@b.c", firstName: "A", lastName: "B", avatarUrl: null, role: "AGENT" },
    });
    const { default: Layout } = await import("./layout");
    await expect(Layout({ children: null })).rejects.toThrow("REDIRECT:/agent");
  });
});
