import { AgentCampaignDetail } from "@/components/agent/agent-campaigns";
export default async function AgentCampaignDetailRoute({ params }: { params: Promise<{ id: string }> }) { return <AgentCampaignDetail id={(await params).id} />; }
