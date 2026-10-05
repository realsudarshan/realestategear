import { NextRequest, NextResponse } from "next/server";
import { agentGoogleStartUrl } from "@/lib/agent-google";
import { safeAgentPath } from "@/lib/agent";

export async function GET(request: NextRequest) {
  const returnTo = safeAgentPath(request.nextUrl.searchParams.get("return_to"));
  return NextResponse.redirect(agentGoogleStartUrl(returnTo), 302);
}
