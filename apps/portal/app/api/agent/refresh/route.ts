import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAgentToken } from "@/lib/agent-auth-server";
import { agentTokenCookieOptions } from "@/lib/agent-auth";
import { refreshAgentAccessToken } from "@/lib/agent-session";

export async function POST() {
  const token = await getAgentToken();
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }
  const next = await refreshAgentAccessToken(token);
  if (!next) {
    const cookieStore = await cookies();
    cookieStore.delete(agentTokenCookieOptions(token).name);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
