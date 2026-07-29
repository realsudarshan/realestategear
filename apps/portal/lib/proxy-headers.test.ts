import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { buildProxyHeaders } from "./proxy-headers";

function requestWith(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/proxy/x", { headers }).headers;
}

describe("buildProxyHeaders", () => {
  it("always sets Content-Type and no X-Forwarded-For when nothing is present", () => {
    const headers = buildProxyHeaders(requestWith({}));
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Forwarded-For"]).toBeUndefined();
  });

  it("prefers cf-connecting-ip over the others", () => {
    const headers = buildProxyHeaders(
      requestWith({ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }),
    );
    expect(headers["X-Forwarded-For"]).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip when cf-connecting-ip is absent", () => {
    const headers = buildProxyHeaders(requestWith({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }));
    expect(headers["X-Forwarded-For"]).toBe("2.2.2.2");
  });

  it("falls back to x-forwarded-for when neither of the others is present", () => {
    const headers = buildProxyHeaders(requestWith({ "x-forwarded-for": "3.3.3.3" }));
    expect(headers["X-Forwarded-For"]).toBe("3.3.3.3");
  });

  it("merges extra headers (e.g. Authorization) without dropping them", () => {
    const headers = buildProxyHeaders(requestWith({}), { Authorization: "Bearer abc" });
    expect(headers.Authorization).toBe("Bearer abc");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("also works with a plain Headers instance (the shape next/headers's headers() returns, used by server actions)", () => {
    const headers = buildProxyHeaders(new Headers({ "x-forwarded-for": "9.9.9.9" }));
    expect(headers["X-Forwarded-For"]).toBe("9.9.9.9");
  });
});
