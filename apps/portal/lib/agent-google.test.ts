import { describe, expect, it } from "vitest";
import { agentCallbackBase, agentGoogleStartUrl } from "./agent-google";

describe("agentGoogleStartUrl", () => {
  it("sends purpose=agent and the API allowlisted callback_base", () => {
    const url = agentGoogleStartUrl("/agent", {
      AGENT_HQ_URL: "http://localhost:3006",
      NEXT_PUBLIC_API_URL: "http://localhost:3001",
    });
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/api/auth/google/start");
    expect(parsed.searchParams.get("purpose")).toBe("agent");
    expect(parsed.searchParams.get("return_to")).toBe("/agent");
    expect(parsed.searchParams.get("callback_base")).toBe("http://localhost:3006");
  });

  it("defaults callback_base to the API agent-hq fallback", () => {
    expect(agentCallbackBase({})).toBe("http://localhost:3002");
  });
});
