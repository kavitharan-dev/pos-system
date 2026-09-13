import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.ROLLUP_SKIP_NATIVE = "true";
const dir = path.dirname(fileURLToPath(import.meta.url));
const viteBin = path.join(dir, "node_modules", "vite", "bin", "vite.js");
const child = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  shell: false,
});
child.on("exit", (code) => process.exit(code ?? 0));
