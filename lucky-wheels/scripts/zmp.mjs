import { spawn } from "node:child_process";

const [command] = process.argv.slice(2);
if (!new Set(["login", "start", "deploy"]).has(command)) {
  console.error("Usage: node scripts/zmp.mjs <login|start|deploy>");
  process.exit(2);
}

const child = spawn("zmp", [command], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, VITE_APP_TARGET: "miniapp" },
});
child.on("error", (error) => {
  console.error(`Unable to start ZMP CLI: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
