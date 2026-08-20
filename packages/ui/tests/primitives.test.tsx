import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Alert } from "../src/alert";
import { Button } from "../src/button";
import { FormMessage } from "../src/form-message";
import { NativeSelect } from "../src/native-select";
import { Skeleton } from "../src/skeleton";

test("Button exposes loading state and disables submission", () => {
  const html = renderToStaticMarkup(<Button loading loadingLabel="Saving">Save</Button>);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /disabled=""/);
  assert.match(html, />Saving</);
});

test("Button keeps a single child when composed with Radix Slot", () => {
  const html = renderToStaticMarkup(<Button asChild><a href="/properties">Properties</a></Button>);
  assert.match(html, /href="\/properties"/);
});

test("FormMessage chooses accessible live-region roles", () => {
  assert.match(renderToStaticMarkup(<FormMessage variant="error">Invalid</FormMessage>), /role="alert"/);
  assert.match(renderToStaticMarkup(<FormMessage>Saved</FormMessage>), /role="status"/);
});

test("Alert leaves announcement priority to the caller", () => {
  assert.doesNotMatch(renderToStaticMarkup(<Alert>Information</Alert>), /role=/);
});

test("NativeSelect preserves native form behavior", () => {
  const html = renderToStaticMarkup(
    <NativeSelect name="status" defaultValue="active">
      <option value="active">Active</option>
    </NativeSelect>,
  );
  assert.match(html, /name="status"/);
  assert.match(html, /selected=""/);
});

test("Skeleton respects reduced-motion preferences", () => {
  assert.match(renderToStaticMarkup(<Skeleton />), /motion-reduce:animate-none/);
});

test("declares exactly the Radix primitives imported by the package", async () => {
  const sourceDirectory = new URL("../src/", import.meta.url);
  const sourceFiles = (await readdir(sourceDirectory)).filter((file) => file.endsWith(".tsx"));
  const importedPrimitives = new Set<string>();

  for (const file of sourceFiles) {
    const source = await readFile(new URL(file, sourceDirectory), "utf8");
    for (const match of source.matchAll(/from ["'](@radix-ui\/react-[^"']+)["']/g)) {
      importedPrimitives.add(match[1]);
    }
  }

  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { dependencies: Record<string, string> };
  const declaredPrimitives = Object.keys(manifest.dependencies).filter((name) =>
    name.startsWith("@radix-ui/react-"),
  );

  assert.equal(manifest.dependencies["radix-ui"], undefined);
  assert.deepEqual(declaredPrimitives.sort(), [...importedPrimitives].sort());
});
