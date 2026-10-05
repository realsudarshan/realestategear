export default function AgentAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agent workspace</p>
        {children}
      </main>
    </div>
  );
}
