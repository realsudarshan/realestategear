import { NextRequest, NextResponse } from "next/server";
import { authorizedAgentFetch } from "@/lib/agent-session";

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = params.path?.join("/") ?? "";
  const response = await authorizedAgentFetch(`/api/search/${path}${request.nextUrl.search}`);
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}
