import { cp } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = resolve(import.meta.dirname, "..");
const standaloneRoot = resolve(appRoot, ".next/standalone/apps/portal");
const port = process.argv[2] ?? "3006";

await Promise.all([
  cp(resolve(appRoot, ".next/static"), resolve(standaloneRoot, ".next/static"), {
    recursive: true,
    force: true,
  }),
  cp(resolve(appRoot, "public"), resolve(standaloneRoot, "public"), {
    recursive: true,
    force: true,
  }),
]);

process.env.PORT = port;
process.env.HOSTNAME ??= "127.0.0.1";
await import(pathToFileURL(resolve(standaloneRoot, "server.js")).href);
