import { execFileSync } from "node:child_process";

const packages = [
  { workspace: "@realestategear/api-client", extras: new Set(["README.md"]) },
  {
    workspace: "@realestategear/tokens",
    extras: new Set(["README.md", "preset.css", "palette.default.css"]),
  },
  { workspace: "@realestategear/ui", extras: new Set(["README.md"]) },
];

for (const entry of packages) {
  const output = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts", `--workspace=${entry.workspace}`],
    { encoding: "utf8" },
  );
  const [manifest] = JSON.parse(output);
  const paths = manifest.files.map((file) => file.path);

  for (const path of paths) {
    const allowed = path === "package.json" || path.startsWith("dist/") || entry.extras.has(path);
    if (!allowed) throw new Error(`${entry.workspace} would publish unexpected file: ${path}`);
    const isSource = /\.tsx$/.test(path) || (/\.ts$/.test(path) && !/\.d\.ts$/.test(path));
    if (isSource || /\.(?:map|tsbuildinfo)$/.test(path)) {
      throw new Error(`${entry.workspace} would publish source or build metadata: ${path}`);
    }
  }

  for (const required of ["package.json", "README.md", "dist/LICENSE", "dist/NOTICE"]) {
    if (!paths.includes(required)) throw new Error(`${entry.workspace} is missing ${required}`);
  }

  console.log(`${entry.workspace}: ${manifest.entryCount} files, ${manifest.size} byte tarball`);
}
