"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@realestategear/ui/button";

export function AgentLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/agent/logout", { method: "POST" });
      if (!res.ok) throw new Error("logout failed");
      router.push("/agent/login");
      router.refresh();
    } catch {
      setError("Could not log out. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={handleClick}
        loading={pending}
        loadingLabel="Logging out…"
      >
        Log out
      </Button>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
