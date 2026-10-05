import { redirect } from "next/navigation";

/** Email reset links target `/reset-password`; send agents to the workspace form. */
export default async function PasswordResetRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token;
  const dest = token
    ? `/agent/reset-password?token=${encodeURIComponent(token)}`
    : "/agent/reset-password";
  redirect(dest);
}
