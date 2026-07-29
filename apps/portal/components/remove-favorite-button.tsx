"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@realestategear/ui/button";

export function RemoveFavoriteButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch(`/api/proxy/users/favorites/${listingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("remove failed");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleClick}>
        {pending ? "Removing…" : "Remove"}
      </Button>
      {error ? <span className="text-xs text-destructive">Couldn&rsquo;t remove — try again</span> : null}
    </span>
  );
}
