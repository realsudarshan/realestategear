import { AgentPortalSettingsPage } from "@/components/agent/agent-portal-management";

export default async function AgentPortalSettingsRoute({ params }: { params: Promise<{ id: string }> }) {
  return <AgentPortalSettingsPage id={(await params).id} />;
}
