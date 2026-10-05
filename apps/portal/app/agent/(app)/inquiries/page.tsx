import Link from "next/link";

export default function AgentInquiriesPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Inquiries</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Portal inquiries for this account. Return to the{" "}
        <Link href="/agent" className="font-semibold text-primary hover:underline">
          dashboard
        </Link>
        .
      </p>
    </section>
  );
}
