import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }));
const loadAgentSession = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/agent-session", () => ({ loadAgentSession }));
vi.mock("@/components/agent/agent-shell", () => ({
  AgentShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/agent/agent-api-disabled", () => ({
  AgentApiDisabled: () => <div>Agent API is disabled</div>,
}));

describe("Agent protected layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to login", async () => {
    loadAgentSession.mockResolvedValue({ status: "unauthenticated" });
    const { default: Layout } = await import("./layout");
    await expect(Layout({ children: null })).rejects.toThrow("REDIRECT:/agent/login?from=%2Fagent");
  });

  it("renders the disabled Agent API state instead of the workspace", async () => {
    loadAgentSession.mockResolvedValue({ status: "disabled" });
    const { default: Layout } = await import("./layout");
    const ui = await Layout({ children: <p>secret</p> });
    expect(JSON.stringify(ui)).toContain("Agent API is disabled");
  });
});
