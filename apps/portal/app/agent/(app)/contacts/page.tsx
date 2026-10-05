import Link from "next/link";

export default function AgentContactsPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Contact records for this account. Return to the{" "}
        <Link href="/agent" className="font-semibold text-primary hover:underline">
          dashboard
        </Link>
        .
      </p>
    </section>
  );
}
