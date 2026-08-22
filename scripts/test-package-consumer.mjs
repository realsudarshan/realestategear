import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const directory = await mkdtemp(join(tmpdir(), "realestategear-package-consumer-"));

function run(command, args, cwd = root) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

try {
  const tarballs = {};
  for (const workspace of ["@realestategear/api-client", "@realestategear/tokens", "@realestategear/ui"]) {
    tarballs[workspace] = run("npm", [
      "pack",
      "--ignore-scripts",
      `--workspace=${workspace}`,
      "--pack-destination",
      directory,
    ]).split("\n").at(-1);
  }

  await writeFile(join(directory, "package.json"), JSON.stringify({
    name: "realestategear-package-consumer-test",
    private: true,
    type: "module",
    scripts: { test: "node index.mjs && tsc --noEmit" },
    dependencies: {
      "@realestategear/api-client": `file:./${tarballs["@realestategear/api-client"]}`,
      "@realestategear/tokens": `file:./${tarballs["@realestategear/tokens"]}`,
      "@realestategear/ui": `file:./${tarballs["@realestategear/ui"]}`,
      react: "19.2.0",
      "react-dom": "19.2.0",
      tailwindcss: "^4",
      "tw-animate-css": "^1.4.0",
    },
    devDependencies: {
      "@types/react": "^19",
      typescript: "^5",
    },
  }, null, 2));

  await writeFile(join(directory, "index.mjs"), `
import assert from "node:assert/strict";
import { resolvePublicApiBaseUrl } from "@realestategear/api-client";
import { compileThemeCss } from "@realestategear/tokens/theme";
import { Button, Command, DateTimePicker, NativeSelect, Popover } from "@realestategear/ui";
import { Calendar } from "@realestategear/ui/calendar";
import { Command as CommandSubpath } from "@realestategear/ui/command";
import { DateTimePicker as DateTimePickerSubpath } from "@realestategear/ui/date-time-picker";
import { SortableTableHead } from "@realestategear/ui/table";
assert.equal(resolvePublicApiBaseUrl({ NEXT_PUBLIC_API_URL: "https://api.example.com/" }), "https://api.example.com");
assert.match(compileThemeCss({ palette: { primary: "#065f46" } }), /--primary:/);
assert.equal(typeof Button, "function");
assert.equal(typeof NativeSelect, "function");
assert.equal(typeof Popover, "function");
assert.equal(typeof Calendar, "function");
assert.equal(typeof Command, "function");
assert.equal(CommandSubpath, Command);
assert.equal(typeof DateTimePicker, "function");
assert.equal(DateTimePickerSubpath, DateTimePicker);
assert.equal(typeof SortableTableHead, "function");
assert.match(import.meta.resolve("@realestategear/tokens/preset.css"), /preset\\.css$/);
`);

  await writeFile(join(directory, "consumer.tsx"), `
import { Button, Command, CommandDialog, DateTimePicker, NativeSelect } from "@realestategear/ui";
import { Calendar } from "@realestategear/ui/calendar";
import { Command as CommandSubpath } from "@realestategear/ui/command";
import { DateTimePicker as DateTimePickerSubpath } from "@realestategear/ui/date-time-picker";
import { SortableTableHead } from "@realestategear/ui/table";
export const form = <form><NativeSelect name="status"><option value="active">Active</option></NativeSelect><Button type="submit" loading={false}>Save</Button></form>;
export const heading = <SortableTableHead sortDirection="ascending" onSort={() => {}}>Price</SortableTableHead>;
export const calendar = <Calendar mode="single" weekStartsOn={1} />;
export const dateTimePicker = <DateTimePicker label="Appointment" value={new Date()} onChange={() => {}} timeZone="UTC" minuteStep={15} />;
export const dateTimePickerSubpath = <DateTimePickerSubpath label="Appointment" onChange={() => {}} />;
export const command = <Command label="Actions" />;
export const commandSubpath = <CommandSubpath label="Actions" />;
export const commandDialog = <CommandDialog title="Actions" description="Choose an action" commandLabel="Actions" open={false}><div /></CommandDialog>;
`);
  await writeFile(join(directory, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      strict: true,
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      jsx: "react-jsx",
      skipLibCheck: true,
    },
    include: ["consumer.tsx"],
  }, null, 2));

  execFileSync("npm", ["install", "--ignore-scripts", "--package-lock=false"], { cwd: directory, stdio: "inherit" });
  execFileSync("npm", ["test"], { cwd: directory, stdio: "inherit" });
  console.log("Fresh tarball consumer passed runtime and declaration checks.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
