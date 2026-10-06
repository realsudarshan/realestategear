import { NextRequest, NextResponse } from "next/server";
import { authorizedAgentFetch } from "@/lib/agent-session";

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, await context.params);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return forward(request, await context.params);
}
export async function PUT(request: NextRequest, context: RouteContext) {
  return forward(request, await context.params);
}
export async function PATCH(request: NextRequest, context: RouteContext) {
  return forward(request, await context.params);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return forward(request, await context.params);
}

async function forward(request: NextRequest, params: { path?: string[] }) {
  const path = params.path?.join("/") ?? "";
  const body = request.method === "GET" || request.method === "DELETE"
    ? undefined
    : await request.text();
  const response = await authorizedAgentFetch(`/api/agent/${path}${request.nextUrl.search}`, {
    method: request.method,
    body: body || undefined,
    headers: { "Content-Type": request.headers.get("content-type") ?? "application/json" },
  });
  return new NextResponse(response.body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}
