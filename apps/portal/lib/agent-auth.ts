export const AGENT_TOKEN_COOKIE_NAME = "agent_token";

export function agentTokenCookieOptions(token: string) {
  return {
    name: AGENT_TOKEN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
  };
}
