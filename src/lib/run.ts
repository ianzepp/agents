import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { runMetaPath, runDir, runLogPath } from "./paths.ts";

export type RunStatus = "running" | "completed" | "failed";

export interface Run {
  id: string;
  repo?: string;
  issue?: number;
  persona?: string;
  model: string;
  branch?: string;
  status: RunStatus;
  pid: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export function readRun(id: string): Run | null {
  const path = runMetaPath(id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Run;
  }
  catch {
    return null;
  }
}

export function writeRun(run: Run): void {
  writeFileSync(runMetaPath(run.id), JSON.stringify(run, null, 2));
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  }
  catch {
    return false;
  }
}

export function getRunStatus(run: Run): RunStatus {
  if (run.status !== "running") return run.status;

  const responsePath = join(runDir(run.id), "response.md");

  // Check if response.md exists (successful completion)
  if (existsSync(responsePath)) {
    return "completed";
  }

  // Check if process is still alive
  if (run.pid && !isProcessRunning(run.pid)) {
    // Process exited - check if there's output to promote to response
    const logPath = runLogPath(run.id);
    try {
      const stat = statSync(logPath);
      if (stat.size > 1) {
        // Auto-create response.md from output.log
        const output = readFileSync(logPath, "utf-8").trim();
        if (output) {
          writeFileSync(responsePath, output);
          return "completed";
        }
      }
    }
    catch {
      // Fall through to failed
    }
    return "failed"; // Process died without output
  }
  return "running";
}

export function generateRunId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function generateBranch(issue: number | undefined, model: string, id: string): string {
  const issueStr = issue ? `issue-${issue}` : "task";
  const modelShort = model.split("/").pop()?.split("-")[0] ?? model;
  return `${issueStr}-${modelShort}-${id}`;
}
