import { describe, expect, it } from "vitest";
import { consumeSseChunk, parseSseFrame, safeAiError } from "./agent-ai";

describe("agent AI SSE helpers", () => {
  it("parses split frames and multiline data", () => {
    const first = consumeSseChunk('data: {"content":"hello"}\n\npartial');
    expect(first.events).toEqual([{ content: "hello" }]);
    const second = consumeSseChunk(`${first.remainder}\ndata: {"done":true,"entities":[]}\n\n`, true);
    expect(second.events).toEqual([{ done: true, entities: [] }]);
  });
  it("rejects malformed and truncated frames safely", () => {
    expect(() => parseSseFrame("data: {not-json}")).toThrow("malformed");
    expect(() => consumeSseChunk("data: {\"content\":\"unfinished\"", true)).toThrow("malformed");
    expect(safeAiError(new Error("OPENAI_API_KEY missing"))).toMatch(/AI service is unavailable/i);
  });
});
