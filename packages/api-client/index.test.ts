import assert from "node:assert/strict";
import test from "node:test";

import { resolvePublicApiBaseUrl, resolveServerApiBaseUrl } from "./index";

test("public URL resolution ignores server-only and inherited values", () => {
  const inherited = Object.create({ NEXT_PUBLIC_API_URL: "https://attacker.example" });
  inherited.API_URL = "https://internal.example";

  assert.equal(resolvePublicApiBaseUrl(inherited), "http://localhost:3001");
});

test("public URL resolution uses only the explicit public URL", () => {
  assert.equal(
    resolvePublicApiBaseUrl({
      NEXT_PUBLIC_API_URL: "https://portal-api.example.com/",
      API_URL: "https://internal.example",
    }),
    "https://portal-api.example.com",
  );
});

test("URL resolution rejects credentials and unsafe schemes", () => {
  assert.throws(
    () => resolveServerApiBaseUrl({ API_URL: "https://user:secret@example.com" }),
    /must not contain credentials/,
  );
  assert.throws(
    () => resolvePublicApiBaseUrl({ NEXT_PUBLIC_API_URL: "javascript:alert(1)" }),
    /must use http or https/,
  );
});

test("server URL resolution preserves explicit precedence", () => {
  assert.equal(
    resolveServerApiBaseUrl({
      API_INTERNAL_URL: "http://api:3001/",
      API_URL: "https://api.example.com",
    }),
    "http://api:3001",
  );
});
