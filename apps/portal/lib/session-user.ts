/**
 * Pure session-user helpers — safe to import from both server and client
 * components. The server-only piece (`getSessionUser`) lives in
 * `session-user-server.ts` so client components can import these helpers
 * without poisoning the bundle with `next/headers`.
 */

export type SessionUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  accountId: string;
  portalId: string | null;
  avatarUrl: string | null;
};

/**
 * Returns the display name — full name if both first+last, else first, else
 * the local part of the email.
 */
export function displayNameFor(user: SessionUser | null): string {
  if (!user) return "there";
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  return user.email.split("@")[0];
}
