import Link from "next/link";

export default function AgentTransactionsPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Open and closed transactions. Return to the{" "}
        <Link href="/agent" className="font-semibold text-primary hover:underline">
          dashboard
        </Link>
        .
      </p>
    </section>
  );
}
