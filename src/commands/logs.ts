import { existsSync, readFileSync } from "fs";
import { runLogPath } from "../lib/paths.ts";
import { readRun } from "../lib/run.ts";

export function logs(id: string): void {
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

  const content = readFileSync(logPath, "utf-8");
  console.log(content);
}
