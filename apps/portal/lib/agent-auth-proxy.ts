import { NextRequest, NextResponse } from "next/server";
import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { buildProxyHeaders } from "@/lib/proxy-headers";
import { establishSessionResponse } from "@/lib/establish-session";
import { agentTokenCookieOptions } from "@/lib/agent-auth";

const API_BASE = () => resolveServerApiBaseUrl(process.env);

export async function proxyAgentAuthPost(
  request: NextRequest,
  apiPath: string,
  options: { establishSession?: boolean } = {},
): Promise<NextResponse> {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const res = await fetch(`${API_BASE()}${apiPath}`, {
    method: "POST",
    headers: buildProxyHeaders(request.headers),
    body,
  });

  if (options.establishSession) {
    return establishSessionResponse(res, agentTokenCookieOptions);
  }

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
