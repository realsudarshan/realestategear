import { cookies } from "next/headers";
import { AGENT_TOKEN_COOKIE_NAME } from "./agent-auth";

export async function getAgentToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(AGENT_TOKEN_COOKIE_NAME)?.value;
}

export async function clearAgentToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AGENT_TOKEN_COOKIE_NAME);
}
