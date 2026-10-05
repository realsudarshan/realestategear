import { NextResponse } from "next/server";
import { authorizedAgentFetch } from "@/lib/agent-session";

export async function GET() {
  const res = await authorizedAgentFetch("/api/auth/me");
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
