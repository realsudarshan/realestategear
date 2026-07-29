"use client";

export default function OwnerLeadsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-md border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-bold text-foreground">Couldn&rsquo;t load the lead inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">The owner service is temporarily unavailable. Your leads are still stored safely.</p>
        <button className="mt-5 rounded-md border border-border px-4 py-2 text-sm font-semibold" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
