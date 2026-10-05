import { describe, expect, it } from "vitest";
import { isAgentApiDisabled, isDashboardEmpty, resolveAgentRouteRedirect, safeAgentPath } from "./agent";

describe("resolveAgentRouteRedirect", () => {
  it("sends unauthenticated visitors from protected Agent routes to login", () => {
    expect(resolveAgentRouteRedirect("/agent", false)).toBe("/agent/login?from=%2Fagent");
    expect(resolveAgentRouteRedirect("/agent/settings", false)).toBe("/agent/login?from=%2Fagent%2Fsettings");
  });

  it("sends authenticated agents away from login and register", () => {
    expect(resolveAgentRouteRedirect("/agent/login", true)).toBe("/agent");
    expect(resolveAgentRouteRedirect("/agent/register", true)).toBe("/agent");
    expect(resolveAgentRouteRedirect("/agent/forgot-password", true)).toBe("/agent");
    expect(resolveAgentRouteRedirect("/agent/reset-password", true)).toBe("/agent");
  });

  it("does not redirect authenticated agents on the dashboard", () => {
    expect(resolveAgentRouteRedirect("/agent", true)).toBeNull();
  });

  it("does not redirect guests on auth pages", () => {
    expect(resolveAgentRouteRedirect("/agent/login", false)).toBeNull();
  });
});

describe("safeAgentPath", () => {
  it("allows in-app Agent paths", () => {
    expect(safeAgentPath("/agent/settings")).toBe("/agent/settings");
  });

  it("rejects open redirects", () => {
    expect(safeAgentPath("//evil.com")).toBe("/agent");
    expect(safeAgentPath("https://evil.com")).toBe("/agent");
    expect(safeAgentPath("/favorites")).toBe("/agent");
  });
});

describe("isAgentApiDisabled", () => {
  it("matches the fail-closed Agent API payload", () => {
    expect(isAgentApiDisabled(404, { code: "AGENT_API_DISABLED", error: "Agent API is disabled" })).toBe(true);
    expect(isAgentApiDisabled(404, { error: "not found" })).toBe(false);
    expect(isAgentApiDisabled(401, { code: "AGENT_API_DISABLED" })).toBe(false);
  });
});

describe("isDashboardEmpty", () => {
  it("is true only when stats and lists are empty", () => {
    expect(
      isDashboardEmpty({
        stats: { activeContacts: 0, openTransactions: 0, pendingTasks: 0, closedThisMonth: 0 },
        recentContacts: [],
        upcomingTasks: [],
      }),
    ).toBe(true);
    expect(
      isDashboardEmpty({
        stats: { activeContacts: 1, openTransactions: 0, pendingTasks: 0, closedThisMonth: 0 },
        recentContacts: [],
        upcomingTasks: [],
      }),
    ).toBe(false);
  });
});
