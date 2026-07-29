import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const packageDir = process.cwd();
const rootDir = resolve(packageDir, "../..");
const distDir = resolve(packageDir, "dist");

await mkdir(distDir, { recursive: true });

async function copyIfExists(filename) {
  try {
    await copyFile(resolve(rootDir, filename), resolve(distDir, filename));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

await Promise.all([
  copyIfExists("LICENSE"),
  copyIfExists("NOTICE"),
]);
