import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { AGENT_HOME, safeAgentPath } from "./agent";

/** Must match `resolveOAuthCallbackBase('agent')` on the API. */
export function agentCallbackBase(env: Partial<NodeJS.ProcessEnv> = process.env): string {
  return (env.AGENT_HQ_URL || "http://localhost:3002").replace(/\/$/, "");
}

export function agentGoogleStartUrl(returnTo: string, env: Partial<NodeJS.ProcessEnv> = process.env): string {
  const api = resolveServerApiBaseUrl(env);
  const dest = new URL("/api/auth/google/start", `${api}/`);
  dest.searchParams.set("purpose", "agent");
  dest.searchParams.set("return_to", safeAgentPath(returnTo));
  dest.searchParams.set("callback_base", agentCallbackBase(env));
  return dest.toString();
}

export async function isGoogleSignInAvailable(env: Partial<NodeJS.ProcessEnv> = process.env): Promise<boolean> {
  const dest = agentGoogleStartUrl(AGENT_HOME, env);
  const res = await fetch(dest, { redirect: "manual", cache: "no-store" });
  return res.status === 302 || res.status === 301;
}
