export type ChatMessage = { role: "user" | "assistant"; content: string };
export type LinkedEntity = { type: "contact" | "property" | "task" | "transaction" | "action_item"; id: string; label: string; href: string; meta: string[] };
export type ChatEvent = { content?: string; entities?: LinkedEntity[]; done?: boolean; error?: string };
export type AgentAction = {
  id: string; toolName: string; toolType: string; label: string; reason?: string | null;
  payload: Record<string, unknown>; previewData?: Record<string, unknown> | null;
  status: string; requiresConfirmation: boolean; priority: number; dueAt?: string | null;
  snoozedUntil?: string | null; lastError?: string | null; suggestedAt?: string;
  contact?: { id: string; firstName: string; lastName: string; stage: string; email?: string | null } | null;
  property?: { id: string; address: string; city: string; state: string } | null;
  transaction?: { id: string; address: string; stage: string; type: string } | null;
};
export type ActionResponse = { actions: AgentAction[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

export function parseSseFrame(frame: string): ChatEvent | null {
  const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
  if (!data) return null;
  try {
    const value = JSON.parse(data) as ChatEvent;
    if (!value || typeof value !== "object") throw new Error("Invalid event");
    if (value.content !== undefined && typeof value.content !== "string") throw new Error("Invalid content");
    if (value.error !== undefined && typeof value.error !== "string") throw new Error("Invalid error");
    return value;
  } catch {
    throw new Error("The AI stream contained malformed data.");
  }
}

export function consumeSseChunk(buffer: string, final = false): { events: ChatEvent[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const remainder = final ? "" : parts.pop() ?? "";
  if (final && remainder.trim()) parts.push(remainder);
  const events: ChatEvent[] = [];
  for (const part of parts) {
    const event = parseSseFrame(part);
    if (event) events.push(event);
  }
  return { events, remainder };
}

export function safeAiError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/api key|openai|unavailable|503|502/i.test(message)) return "The AI service is unavailable. Check the server AI configuration and try again.";
  if (/malformed|stream/i.test(message)) return "The AI response was incomplete or malformed. Please try again.";
  return message || "The AI request failed. Please try again.";
}
