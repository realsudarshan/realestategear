import { AgentTransactionDetail } from "@/components/agent/agent-transaction-crm";

export default async function AgentTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentTransactionDetail id={id} />;
}
