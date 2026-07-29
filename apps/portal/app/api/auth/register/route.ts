import { NextRequest, NextResponse } from "next/server";
import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { buildProxyHeaders } from "@/lib/proxy-headers";
import { establishSessionResponse } from "@/lib/establish-session";
import { PORTAL_SLUG } from "@/lib/portal";

const API_BASE = resolveServerApiBaseUrl(process.env);

/** Server-side register proxy. Mirrors /api/auth/login/route.ts. */
export async function POST(request: NextRequest) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/api/portals/${PORTAL_SLUG}/auth/register`, {
    method: "POST",
    headers: buildProxyHeaders(request.headers),
    body,
  });

  return establishSessionResponse(res);
}
