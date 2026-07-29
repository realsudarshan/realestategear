import { cookies } from "next/headers";

const TOKEN_COOKIE = "portal_token";

export async function getToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE)?.value;
}

export function tokenCookieOptions(token: string) {
  return {
    name: TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24, // 24h, matches the API's consumer token expiry
  };
}

export const TOKEN_COOKIE_NAME = TOKEN_COOKIE;
