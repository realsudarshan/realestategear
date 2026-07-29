import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { tokenCookieOptions } from "./auth";

/**
 * Turns an upstream auth response (login/register) into the client-facing
 * response: sets the httpOnly session cookie server-side and strips the raw
 * token out of the body the client ever sees. The token never has to touch
 * client JS or a second, independently-reachable endpoint — closes off the
 * login-CSRF class entirely rather than adding an Origin check to a
 * standalone set-token route.
 *
 * Falls back to relaying the upstream body verbatim if it isn't the
 * {token, ...} shape we expect (e.g. an error response).
 */
export async function establishSessionResponse(upstream: Response): Promise<NextResponse> {
  const data = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "application/json";

  if (upstream.ok) {
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      if (typeof parsed.token === "string") {
        const cookieStore = await cookies();
        cookieStore.set(tokenCookieOptions(parsed.token));
        const { token: _token, ...rest } = parsed;
        return NextResponse.json(rest, { status: upstream.status });
      }
    } catch {
      // Not the expected shape — fall through to a verbatim relay below.
    }
  }

  return new NextResponse(data, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
