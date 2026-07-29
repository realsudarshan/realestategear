import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { buildProxyHeaders } from "@/lib/proxy-headers";
import { TOKEN_COOKIE_NAME } from "@/lib/auth";
import { PORTAL_SLUG } from "@/lib/portal";

const API_BASE = resolveServerApiBaseUrl(process.env);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, await params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, await params);
}

async function proxy(request: NextRequest, params: { path?: string[] }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = params.path?.join("/") ?? "";
  const pathWithApi = path.startsWith("api/") ? path : `api/${path}`;
  const url = new URL(pathWithApi + request.nextUrl.search, API_BASE);

  const headers = buildProxyHeaders(request.headers, {
    Authorization: `Bearer ${token}`,
    "X-Portal-Slug": PORTAL_SLUG,
  });

  let body: string | undefined;
  if (request.method === "POST" || request.method === "PATCH") {
    try {
      body = await request.text();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
  }

  const res = await fetch(url.toString(), {
    method: request.method,
    headers,
    body: body || undefined,
  });

  const data = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";

  const responseHeaders: Record<string, string> = { "Content-Type": contentType };
  const contentDisposition = res.headers.get("content-disposition");
  if (contentDisposition) responseHeaders["Content-Disposition"] = contentDisposition;
  return new NextResponse(data, {
    status: res.status,
    headers: responseHeaders,
  });
}
