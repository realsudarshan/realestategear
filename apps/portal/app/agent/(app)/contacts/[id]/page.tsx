import { AgentContactDetail } from "@/components/agent/agent-contact-crm";

export default async function AgentContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentContactDetail id={id} />;
}
