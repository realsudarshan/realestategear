import assert from "node:assert/strict";
import test from "node:test";

import { compileThemeCss } from "./theme";

test("compiles a validated radius", () => {
  const css = compileThemeCss({ palette: { primary: "#065f46" }, radius: "8px" });
  assert.match(css, /--radius: 8px;/);
});

test("rejects radius values that can escape a CSS declaration", () => {
  assert.throws(
    () => compileThemeCss({ palette: { primary: "#065f46" }, radius: "0; } body { color: red" }),
    /expected 0 or a non-negative px, rem, or em length/,
  );
  assert.throws(
    () => compileThemeCss({ palette: { primary: "#065f46" }, radius: "url(https://example.com)" }),
    /expected 0 or a non-negative px, rem, or em length/,
  );
});
