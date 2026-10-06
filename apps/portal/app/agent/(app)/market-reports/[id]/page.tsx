import { AgentMarketReportDetail } from "@/components/agent/agent-reports";
export default async function AgentMarketReportRoute({ params }: { params: Promise<{ id: string }> }) { return <AgentMarketReportDetail id={(await params).id} />; }
