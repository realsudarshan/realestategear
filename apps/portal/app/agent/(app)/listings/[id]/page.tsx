import { AgentListingDetailPage } from "@/components/agent/agent-property-discovery";

export default async function AgentListingDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  return <AgentListingDetailPage id={(await params).id} />;
}
