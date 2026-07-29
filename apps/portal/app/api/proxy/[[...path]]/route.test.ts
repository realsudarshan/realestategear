import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { cookies } = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock("next/headers", () => ({ cookies }));

const { GET, POST, DELETE } = await import("./route");

function fakeCookieStore(token: string | undefined) {
  return { get: () => (token === undefined ? undefined : { value: token }) };
}

function fetchResponse(body = "{}", status = 200) {
  return {
    status,
    text: async () => body,
    headers: { get: () => "application/json" },
  };
}

describe("proxy route (/api/proxy/[[...path]])", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cookies.mockReset();
    fetchMock = vi.fn().mockResolvedValue(fetchResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns 401 and never calls fetch when there's no auth cookie", async () => {
    cookies.mockResolvedValue(fakeCookieStore(undefined));
    const request = new NextRequest("http://localhost/api/proxy/users/favorites");
    const res = await GET(request, { params: Promise.resolve({ path: ["users", "favorites"] }) });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a GET with the Authorization header and prefixes the path with api/", async () => {
    cookies.mockResolvedValue(fakeCookieStore("token123"));
    const request = new NextRequest("http://localhost/api/proxy/users/favorites");
    await GET(request, { params: Promise.resolve({ path: ["users", "favorites"] }) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3001/api/users/favorites");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer token123");
    expect(init.body).toBeUndefined();
  });

  it("does not double-prefix a path that already starts with api/", async () => {
    cookies.mockResolvedValue(fakeCookieStore("token123"));
    const request = new NextRequest("http://localhost/api/proxy/api/users/favorites");
    await GET(request, { params: Promise.resolve({ path: ["api", "users", "favorites"] }) });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3001/api/users/favorites");
  });

  it("forwards a DELETE for the remove-favorite call", async () => {
    cookies.mockResolvedValue(fakeCookieStore("token123"));
    const request = new NextRequest("http://localhost/api/proxy/users/favorites/listing1", { method: "DELETE" });
    await DELETE(request, { params: Promise.resolve({ path: ["users", "favorites", "listing1"] }) });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3001/api/users/favorites/listing1");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  it("forwards the request body on POST", async () => {
    cookies.mockResolvedValue(fakeCookieStore("token123"));
    const request = new NextRequest("http://localhost/api/proxy/users/favorites", {
      method: "POST",
      body: JSON.stringify({ listingId: "listing1" }),
    });
    await POST(request, { params: Promise.resolve({ path: ["users", "favorites"] }) });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ listingId: "listing1" }));
  });

  it("returns 400 and never calls fetch when the POST body can't be read", async () => {
    cookies.mockResolvedValue(fakeCookieStore("token123"));
    const request = {
      method: "POST",
      nextUrl: new URL("http://localhost/api/proxy/users/favorites"),
      headers: new Headers(),
      text: () => Promise.reject(new Error("stream error")),
    } as unknown as NextRequest;

    const res = await POST(request, { params: Promise.resolve({ path: ["users", "favorites"] }) });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid body" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays the upstream status code and body back to the caller", async () => {
    cookies.mockResolvedValue(fakeCookieStore("token123"));
    fetchMock.mockResolvedValue(fetchResponse(JSON.stringify({ error: "Favorite not found" }), 404));
    const request = new NextRequest("http://localhost/api/proxy/users/favorites/x");
    const res = await GET(request, { params: Promise.resolve({ path: ["users", "favorites", "x"] }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Favorite not found" });
  });
});
