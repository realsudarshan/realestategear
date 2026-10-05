import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { AGENT_TOKEN_COOKIE_NAME } from "@/lib/agent-auth";

export async function POST() {
  try {
    await fetch(`${resolveServerApiBaseUrl(process.env)}/api/auth/logout`, {
      method: "POST",
    });
  } catch {
    // Cookie clear is the source of truth for the browser session.
  }
  const cookieStore = await cookies();
  cookieStore.delete(AGENT_TOKEN_COOKIE_NAME);
  return NextResponse.json({ ok: true, message: "Logged out successfully" });
}
