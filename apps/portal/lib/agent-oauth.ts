import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { agentTokenCookieOptions } from "./agent-auth";
import { AGENT_HOME, AGENT_LOGIN, isAgentApiDisabled, safeAgentPath, type AgentPublicUser } from "./agent";

const AGENT_GOOGLE_ERRORS = new Set(["agent_not_found"]);

export async function establishAgentSessionFromToken(
  token: string,
): Promise<{ ok: true; user: AgentPublicUser } | { ok: false; error: string; status: number }> {
  const me = await fetch(`${resolveServerApiBaseUrl(process.env)}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = (await me.json().catch(() => ({}))) as { user?: AgentPublicUser; code?: string; error?: string };
  if (isAgentApiDisabled(me.status, body)) {
    return { ok: false, error: "Agent API is disabled", status: 404 };
  }
  if (!me.ok) {
    return { ok: false, error: "Invalid token", status: me.status === 401 ? 401 : 400 };
  }
  if (!body.user || (body.user.role !== "AGENT" && body.user.role !== "ADMIN")) {
    return { ok: false, error: "Not an agent account", status: 403 };
  }
  const cookieStore = await cookies();
  cookieStore.set(agentTokenCookieOptions(token));
  return { ok: true, user: body.user };
}

function isAgentReturnPath(path: string | undefined): boolean {
  return Boolean(path && path.startsWith("/agent"));
}

/**
 * Google OAuth returns to `{callback_base}/login?oauth=google&token=…`.
 * Persist an agent JWT in the httpOnly cookie, then drop the token from the URL.
 * Portal-consumer tokens and non-agent Google errors are left for `/login`.
 */
export async function completeAgentGoogleCallback(params: {
  oauth?: string;
  token?: string;
  redirect?: string;
  google_error?: string;
}): Promise<void> {
  if (params.google_error) {
    if (AGENT_GOOGLE_ERRORS.has(params.google_error) || isAgentReturnPath(params.redirect)) {
      redirect(`${AGENT_LOGIN}?google_error=${encodeURIComponent(params.google_error)}`);
    }
    return;
  }
  if (params.oauth !== "google" || !params.token) return;

  const result = await establishAgentSessionFromToken(params.token);
  if (result.ok === true) {
    redirect(safeAgentPath(params.redirect) || AGENT_HOME);
  }
  if (result.ok === false && result.status === 403) return;
  if (result.ok === false && (isAgentReturnPath(params.redirect) || result.status === 404)) {
    redirect(`${AGENT_LOGIN}?google_error=oauth_failed`);
  }
}
