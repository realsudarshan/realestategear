import { Alert, AlertDescription, AlertTitle } from "@realestategear/ui/alert";

export function AgentApiDisabled({
  title = "Agent API is disabled",
}: {
  title?: string;
}) {
  return (
    <Alert variant="warning" role="alert">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>
          This workspace cannot talk to Agent routes because{" "}
          <code className="font-mono text-xs">AGENT_API_ENABLED</code> is not{" "}
          <code className="font-mono text-xs">true</code> on the API. Ask an
          administrator to enable the Agent API, then try again.
        </p>
      </AlertDescription>
    </Alert>
  );
}
