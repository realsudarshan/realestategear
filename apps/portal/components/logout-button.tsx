"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton({ mobile = false }: { mobile?: boolean } = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("logout failed");
      router.push("/");
      router.refresh();
    } catch {
      // Logout deletes an httpOnly cookie server-side — client JS can't do
      // it directly, so on failure the session is still live. Don't
      // navigate away as if it succeeded; let the user retry.
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className={mobile ? "flex flex-col items-start gap-1" : "hidden items-center gap-1.5 sm:inline-flex"}>
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className={
          mobile
            ? "w-full text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        }
      >
        {pending ? "Logging out…" : "Log out"}
      </button>
      {error ? <span className="text-xs text-destructive">Try again</span> : null}
    </span>
  );
}
