import { NextRequest, NextResponse } from "next/server";
import { establishAgentSessionFromToken } from "@/lib/agent-oauth";

export async function POST(request: NextRequest) {
  let parsed: { token?: string };
  try {
    parsed = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const token = typeof parsed.token === "string" ? parsed.token : "";
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = await establishAgentSessionFromToken(token);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, user: result.user });
}
