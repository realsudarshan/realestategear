import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { AGENT_HOME, safeAgentPath } from "./agent";

export function agentCallbackBase(env: NodeJS.ProcessEnv = process.env): string {
  return (env.AGENT_HQ_URL || env.FRONTEND_URL || "http://localhost:3006").replace(/\/$/, "");
}

export function agentGoogleStartUrl(returnTo: string, env: NodeJS.ProcessEnv = process.env): string {
  const api = resolveServerApiBaseUrl(env);
  const dest = new URL("/api/auth/google/start", `${api}/`);
  dest.searchParams.set("purpose", "agent");
  dest.searchParams.set("return_to", safeAgentPath(returnTo));
  dest.searchParams.set("callback_base", agentCallbackBase(env));
  return dest.toString();
}

export async function isGoogleSignInAvailable(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const dest = agentGoogleStartUrl(AGENT_HOME, env);
  const res = await fetch(dest, { redirect: "manual", cache: "no-store" });
  return res.status === 302 || res.status === 301;
}
