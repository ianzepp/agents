import { spawn } from "child_process";
import { existsSync } from "fs";
import { runLogPath } from "../lib/paths.ts";
import { readRun, getRunStatus } from "../lib/run.ts";

export function watch(id: string): void {
  const run = readRun(id);
  if (!run) {
    console.error(`Error: run ${id} not found`);
    process.exit(1);
  }

  const logPath = runLogPath(id);
  if (!existsSync(logPath)) {
    console.error(`Error: log file not found for run ${id}`);
    process.exit(1);
  }

  const status = getRunStatus(run);
  console.log(`Watching run ${id} (${status})...`);
  console.log(`Repo: ${run.repo}`);
  console.log(`Model: ${run.model}`);
  console.log(`Branch: ${run.branch}`);
  console.log("---");

  // Use tail -f to follow the log
  const tail = spawn("tail", ["-f", logPath], {
    stdio: "inherit",
  });

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    tail.kill();
    process.exit(0);
  });

  tail.on("close", (code) => {
    process.exit(code ?? 0);
  });
}
