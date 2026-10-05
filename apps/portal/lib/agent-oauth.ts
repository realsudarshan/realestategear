import { cookies } from "next/headers";
import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { agentTokenCookieOptions } from "./agent-auth";
import type { AgentPublicUser } from "./agent";

export async function establishAgentSessionFromToken(
  token: string,
): Promise<{ ok: true; user: AgentPublicUser } | { ok: false; error: string; status: number }> {
  const me = await fetch(`${resolveServerApiBaseUrl(process.env)}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!me.ok) {
    return { ok: false, error: "Invalid token", status: me.status === 401 ? 401 : 400 };
  }
  const body = (await me.json()) as { user?: AgentPublicUser };
  if (!body.user || (body.user.role !== "AGENT" && body.user.role !== "ADMIN")) {
    return { ok: false, error: "Not an agent account", status: 403 };
  }
  const cookieStore = await cookies();
  cookieStore.set(agentTokenCookieOptions(token));
  return { ok: true, user: body.user };
}
