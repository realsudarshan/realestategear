import { cookies } from "next/headers";
import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { agentTokenCookieOptions } from "./agent-auth";
import { clearAgentToken, getAgentToken } from "./agent-auth-server";
import {
  AGENT_API_DISABLED_CODE,
  type AgentApiErrorBody,
  type AgentPublicUser,
  isAgentApiDisabled,
} from "./agent";

const API_BASE = () => resolveServerApiBaseUrl(process.env);

export type AgentSessionResult =
  | { status: "ok"; user: AgentPublicUser }
  | { status: "unauthenticated"; reason?: "expired" }
  | { status: "disabled" };

async function readJson(res: Response): Promise<AgentApiErrorBody & { user?: AgentPublicUser; token?: string }> {
  try {
    return (await res.json()) as AgentApiErrorBody & { user?: AgentPublicUser; token?: string };
  } catch {
    return {};
  }
}

export async function refreshAgentAccessToken(token: string): Promise<string | null> {
  const res = await fetch(`${API_BASE()}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) return null;
  const body = await readJson(res);
  if (typeof body.token !== "string") return null;
  const cookieStore = await cookies();
  cookieStore.set(agentTokenCookieOptions(body.token));
  return body.token;
}

export async function fetchAgentMe(token: string): Promise<Response> {
  return fetch(`${API_BASE()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

export async function loadAgentSession(): Promise<AgentSessionResult> {
  let token = await getAgentToken();
  if (!token) return { status: "unauthenticated" };

  let res = await fetchAgentMe(token);
  if (res.status === 401) {
    const body = await readJson(res.clone());
    if (body.error === "Token expired") {
      const refreshed = await refreshAgentAccessToken(token);
      if (!refreshed) {
        await clearAgentToken();
        return { status: "unauthenticated", reason: "expired" };
      }
      token = refreshed;
      res = await fetchAgentMe(token);
    }
  }

  const body = await readJson(res);
  if (isAgentApiDisabled(res.status, body)) {
    return { status: "disabled" };
  }

  if (!res.ok || !body.user?.id) {
    const expired = res.status === 401 && body.error === "Token expired";
    await clearAgentToken();
    return { status: "unauthenticated", reason: expired ? "expired" : undefined };
  }

  if (body.user.role !== "AGENT" && body.user.role !== "ADMIN") {
    await clearAgentToken();
    return { status: "unauthenticated" };
  }

  return { status: "ok", user: body.user };
}

export async function authorizedAgentFetch(apiPath: string, init: RequestInit = {}): Promise<Response> {
  let token = await getAgentToken();
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res = await fetch(`${API_BASE()}${apiPath}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (res.status === 401) {
    const body = await readJson(res.clone());
    if (body.error === "Token expired") {
      const refreshed = await refreshAgentAccessToken(token);
      if (!refreshed) {
        await clearAgentToken();
        return Response.json({ error: "Token expired", code: "TOKEN_EXPIRED" }, { status: 401 });
      }
      headers.set("Authorization", `Bearer ${refreshed}`);
      res = await fetch(`${API_BASE()}${apiPath}`, {
        ...init,
        headers,
        cache: "no-store",
      });
    }
  }

  return res;
}

export function relayUpstream(res: Response, data: string, contentType: string | null): Response {
  return new Response(data, {
    status: res.status,
    headers: { "Content-Type": contentType ?? "application/json" },
  });
}

export { AGENT_API_DISABLED_CODE };
