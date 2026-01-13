import { existsSync, readFileSync } from "fs";
import { runDir } from "../lib/paths.ts";
import { readRun } from "../lib/run.ts";
import { join } from "path";

export function response(id: string): void {
  const run = readRun(id);
  if (!run) {
    console.error(`Error: run ${id} not found`);
    process.exit(1);
  }

  const responsePath = join(runDir(id), "response.md");
  if (!existsSync(responsePath)) {
    console.error(`No response yet for run ${id}`);
    process.exit(1);
  }

  const content = readFileSync(responsePath, "utf-8");
  console.log(content);
}

export function hasResponse(id: string): boolean {
  return existsSync(join(runDir(id), "response.md"));
}
