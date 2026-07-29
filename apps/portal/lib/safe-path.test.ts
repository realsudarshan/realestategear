import { describe, expect, it } from "vitest";
import { safePath } from "./safe-path";

describe("safePath", () => {
  it("returns the path unchanged when it starts with a single slash", () => {
    expect(safePath("/favorites")).toBe("/favorites");
  });

  it("falls back to / for null", () => {
    expect(safePath(null)).toBe("/");
  });

  it("falls back to / for undefined", () => {
    expect(safePath(undefined)).toBe("/");
  });

  it("falls back to / for an empty string", () => {
    expect(safePath("")).toBe("/");
  });

  it("falls back to / for a relative path with no leading slash", () => {
    expect(safePath("favorites")).toBe("/");
  });

  it("falls back to / for a protocol-relative URL (open-redirect guard)", () => {
    expect(safePath("//evil.com")).toBe("/");
  });

  it("falls back to / for an absolute external URL", () => {
    expect(safePath("https://evil.com")).toBe("/");
  });

  // Regression: browsers resolve a leading /\, \/, or \\ the same way as //
  // (backslash is a path/authority separator for special schemes per the
  // WHATWG URL spec), so a plain startsWith("//") check misses these.
  // Verified against Node's URL parser: new URL("/\\evil.com", "https://portal.example.com/login").href === "https://evil.com/"
  it("falls back to / for a backslash-prefixed open-redirect bypass", () => {
    expect(safePath("/\\evil.com")).toBe("/");
  });

  it("falls back to / for a backslash-then-slash bypass", () => {
    expect(safePath("\\/evil.com")).toBe("/");
  });

  it("preserves the search and hash of a legitimate path", () => {
    expect(safePath("/favorites?tab=saved#top")).toBe("/favorites?tab=saved#top");
  });
});
