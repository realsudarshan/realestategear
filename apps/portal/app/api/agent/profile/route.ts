import { NextRequest, NextResponse } from "next/server";
import { authorizedAgentFetch } from "@/lib/agent-session";

export async function PUT(request: NextRequest) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const res = await authorizedAgentFetch("/api/auth/profile", {
    method: "PUT",
    body,
  });
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
